<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

function r48(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function in48():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db48(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school48(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$st=$pdo->prepare('SELECT id FROM schools WHERE code=?');$st->execute([$code]);$id=$st->fetchColumn();if($id)return(int)$id;$st=$pdo->prepare('INSERT INTO schools(code,name) VALUES(?,?) RETURNING id');$st->execute([$code,$c['app']['school_name']??'Sekolah EduPay']);return(int)$st->fetchColumn();}
function admin48():array{if(empty($_SESSION['user'])||($_SESSION['user']['role']??'')!=='admin')r48(403,['ok'=>false,'message'=>'Akses admin diperlukan']);return $_SESSION['user'];}
function phone48(string $v):string{$s=preg_replace('/[\s()\-]/','',trim($v));if(str_starts_with($s,'+62'))$s='0'.substr($s,3);elseif(str_starts_with($s,'62'))$s='0'.substr($s,2);return $s;}
function audit48(PDO $pdo,int $schoolId,int $userId,string $action,array $meta=[]):void{$st=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?::jsonb,?,?)');$st->execute([$schoolId,$userId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function scalar48(PDO $pdo,string $sql,array $args=[]):int{$st=$pdo->prepare($sql);$st->execute($args);return(int)$st->fetchColumn();}

$pdo=db48($config);$schoolId=school48($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v48/health'&&$method==='GET')r48(200,['ok'=>true,'version'=>'4.8','full_migration'=>true]);

if($path==='/api/v48/admin/status'&&$method==='GET'){
  admin48();
  $counts=[
    'classes'=>scalar48($pdo,'SELECT COUNT(*) FROM classes WHERE school_id=?',[$schoolId]),
    'homerooms'=>scalar48($pdo,'SELECT COUNT(*) FROM homeroom_teachers WHERE school_id=?',[$schoolId]),
    'students'=>scalar48($pdo,'SELECT COUNT(*) FROM students WHERE school_id=?',[$schoolId]),
    'feeTypes'=>scalar48($pdo,'SELECT COUNT(*) FROM fee_types WHERE school_id=?',[$schoolId]),
    'bills'=>scalar48($pdo,'SELECT COUNT(*) FROM bills WHERE school_id=?',[$schoolId]),
    'payments'=>scalar48($pdo,'SELECT COUNT(*) FROM payments WHERE school_id=?',[$schoolId]),
    'guardians'=>scalar48($pdo,"SELECT COUNT(*) FROM users WHERE school_id=? AND role='parent'",[$schoolId]),
  ];
  $st=$pdo->prepare('SELECT id,source_fingerprint,classes_count,homerooms_count,students_count,fee_types_count,bills_count,payments_count,guardians_count,created_at FROM data_migration_runs WHERE school_id=? ORDER BY id DESC LIMIT 1');$st->execute([$schoolId]);
  r48(200,['ok'=>true,'counts'=>$counts,'lastMigration'=>$st->fetch()?:null]);
}

if($path==='/api/v48/admin/migrate-all'&&$method==='POST'){
  $admin=admin48();$in=in48();
  $classes=is_array($in['classes']??null)?$in['classes']:[];
  $homerooms=is_array($in['homeroomTeachers']??null)?$in['homeroomTeachers']:[];
  $students=is_array($in['students']??null)?$in['students']:[];
  $fees=is_array($in['feeTypes']??null)?$in['feeTypes']:[];
  $bills=is_array($in['bills']??null)?$in['bills']:[];
  $payments=is_array($in['payments']??null)?$in['payments']:[];
  $fingerprint=trim((string)($in['fingerprint']??''));

  if(!$classes&&!$students&&!$fees&&!$bills&&!$payments&&!$homerooms)r48(422,['ok'=>false,'message'=>'Tidak ada data lokal untuk dimigrasikan']);

  $pdo->beginTransaction();
  try{
    $classMap=[];$teacherMap=[];$studentMap=[];$billMap=[];
    $count=['classes'=>0,'homerooms'=>0,'students'=>0,'feeTypes'=>0,'bills'=>0,'payments'=>0,'guardians'=>0];

    // 1. Classes first, without homeroom assignment.
    foreach($classes as $c){
      $ext=trim((string)($c['id']??$c['externalId']??''));$name=trim((string)($c['name']??''));if($name==='')continue;
      $level=trim((string)($c['level']??''));$year=trim((string)($c['academicYear']??''));$active=($c['active']??true)!==false;$cid=null;
      if($ext!==''){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$cid=$st->fetchColumn()?:null;}
      if(!$cid){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND name=? AND academic_year IS NOT DISTINCT FROM ? ORDER BY id DESC LIMIT 1');$st->execute([$schoolId,$name,$year?:null]);$cid=$st->fetchColumn()?:null;}
      if(!$cid){$st=$pdo->prepare('INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(?,?,?,?,?,?) RETURNING id');$st->execute([$schoolId,$ext?:null,$name,$level?:null,$year?:null,$active]);$cid=(int)$st->fetchColumn();}
      else{$pdo->prepare('UPDATE classes SET external_id=COALESCE(?,external_id),name=?,level=?,academic_year=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$name,$level?:null,$year?:null,$active,$cid]);$cid=(int)$cid;}
      if($ext!=='')$classMap[$ext]=$cid;$classMap['name:'.mb_strtolower($name)]=$cid;$count['classes']++;
    }

    // 2. Homeroom teachers.
    foreach($homerooms as $t){
      $ext=trim((string)($t['id']??$t['externalId']??''));$name=trim((string)($t['name']??''));if($name==='')continue;
      $nip=trim((string)($t['nip']??''));$phone=phone48((string)($t['phone']??''));$email=trim((string)($t['email']??''));$active=($t['active']??true)!==false;$tid=null;
      if($ext!==''){$st=$pdo->prepare('SELECT id FROM homeroom_teachers WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$tid=$st->fetchColumn()?:null;}
      if(!$tid&&$nip!==''){$st=$pdo->prepare("SELECT id FROM homeroom_teachers WHERE school_id=? AND nip=? LIMIT 1");$st->execute([$schoolId,$nip]);$tid=$st->fetchColumn()?:null;}
      if(!$tid){$st=$pdo->prepare('INSERT INTO homeroom_teachers(school_id,external_id,nip,name,phone,email,active) VALUES(?,?,?,?,?,?,?) RETURNING id');$st->execute([$schoolId,$ext?:null,$nip?:null,$name,$phone?:null,$email?:null,$active]);$tid=(int)$st->fetchColumn();}
      else{$pdo->prepare('UPDATE homeroom_teachers SET external_id=COALESCE(?,external_id),nip=?,name=?,phone=?,email=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$nip?:null,$name,$phone?:null,$email?:null,$active,$tid]);$tid=(int)$tid;}
      if($ext!=='')$teacherMap[$ext]=$tid;$count['homerooms']++;
    }

    // Assign teachers to classes after both maps exist.
    $seenTeachers=[];
    foreach($classes as $c){
      $classExt=trim((string)($c['id']??$c['externalId']??''));$className=trim((string)($c['name']??''));$localTeacher=trim((string)($c['homeroomTeacherId']??''));
      $cid=$classExt!==''?($classMap[$classExt]??null):($classMap['name:'.mb_strtolower($className)]??null);if(!$cid)continue;
      $serverTeacher=$localTeacher!==''?($teacherMap[$localTeacher]??null):null;
      if($serverTeacher&&isset($seenTeachers[$serverTeacher]))throw new RuntimeException('Satu wali kelas terhubung ke lebih dari satu kelas aktif pada data lokal');
      if($serverTeacher&&(($c['active']??true)!==false))$seenTeachers[$serverTeacher]=true;
      $pdo->prepare('UPDATE classes SET homeroom_teacher_id=?,updated_at=NOW() WHERE id=?')->execute([$serverTeacher,$cid]);
    }

    // 3. Students.
    foreach($students as $s){
      $ext=trim((string)($s['id']??$s['externalId']??''));$nis=trim((string)($s['nis']??''));$name=trim((string)($s['name']??''));if($nis===''||$name==='')continue;
      $parent=trim((string)($s['parent']??$s['guardianName']??''));$phone=phone48((string)($s['phone']??$s['guardianPhone']??''));$active=($s['active']??true)!==false;$cid=null;
      $classExt=trim((string)($s['classId']??''));$className=trim((string)($s['className']??''));
      if($classExt!==''&&isset($classMap[$classExt]))$cid=$classMap[$classExt];elseif($className!==''&&isset($classMap['name:'.mb_strtolower($className)]))$cid=$classMap['name:'.mb_strtolower($className)];
      $st=$pdo->prepare("INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(school_id,nis) DO UPDATE SET external_id=EXCLUDED.external_id,name=EXCLUDED.name,class_id=EXCLUDED.class_id,guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,active=EXCLUDED.active,updated_at=NOW() RETURNING id");
      $st->execute([$schoolId,$ext?:null,$nis,$name,$cid,$parent?:null,$phone?:null,$active]);$sid=(int)$st->fetchColumn();
      if($ext!=='')$studentMap[$ext]=$sid;$studentMap['nis:'.$nis]=$sid;$count['students']++;
    }

    // 4. Fee types.
    foreach($fees as $f){
      $ext=trim((string)($f['id']??$f['externalId']??''));$name=trim((string)($f['name']??''));if($name==='')continue;$amount=(float)($f['amount']??0);$period=trim((string)($f['period']??''));$active=($f['active']??true)!==false;$fid=null;
      if($ext!==''){$st=$pdo->prepare('SELECT id FROM fee_types WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$fid=$st->fetchColumn()?:null;}
      if(!$fid){$st=$pdo->prepare('SELECT id FROM fee_types WHERE school_id=? AND name=? LIMIT 1');$st->execute([$schoolId,$name]);$fid=$st->fetchColumn()?:null;}
      if(!$fid){$pdo->prepare('INSERT INTO fee_types(school_id,external_id,name,amount,period,active) VALUES(?,?,?,?,?,?)')->execute([$schoolId,$ext?:null,$name,$amount,$period?:null,$active]);}
      else{$pdo->prepare('UPDATE fee_types SET external_id=COALESCE(?,external_id),name=?,amount=?,period=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$name,$amount,$period?:null,$active,$fid]);}
      $count['feeTypes']++;
    }

    // 5. Bills.
    foreach($bills as $b){
      $ext=trim((string)($b['id']??$b['externalId']??''));if($ext==='')continue;$studentExt=trim((string)($b['studentId']??''));$sid=$studentMap[$studentExt]??null;if(!$sid)continue;
      $title=trim((string)($b['title']??'Tagihan'));$amount=(float)($b['amount']??0);$due=trim((string)($b['due']??$b['dueDate']??''))?:null;$status=(string)($b['status']??'unpaid');if(!in_array($status,['unpaid','pending','paid','cancelled'],true))$status='unpaid';$methodPay=trim((string)($b['paymentMethod']??''))?:null;$proof=trim((string)($b['proofName']??''))?:null;
      $st=$pdo->prepare('SELECT id FROM bills WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$bid=$st->fetchColumn()?:null;
      if(!$bid){$st=$pdo->prepare('INSERT INTO bills(school_id,external_id,student_id,title,amount,due_date,status,payment_method,proof_name) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id');$st->execute([$schoolId,$ext,$sid,$title,$amount,$due,$status,$methodPay,$proof]);$bid=(int)$st->fetchColumn();}
      else{$pdo->prepare('UPDATE bills SET student_id=?,title=?,amount=?,due_date=?,status=?,payment_method=?,proof_name=?,updated_at=NOW() WHERE id=?')->execute([$sid,$title,$amount,$due,$status,$methodPay,$proof,$bid]);$bid=(int)$bid;}
      $billMap[$ext]=$bid;$count['bills']++;
    }

    // 6. Payments.
    foreach($payments as $p){
      $ext=trim((string)($p['id']??$p['externalId']??''));$billExt=trim((string)($p['billId']??''));$studentExt=trim((string)($p['studentId']??''));$bid=$billMap[$billExt]??null;$sid=$studentMap[$studentExt]??null;if(!$bid||!$sid)continue;
      if($ext==='')$ext='receipt:'.trim((string)($p['receipt']??''));$amount=(float)($p['amount']??0);$method=trim((string)($p['method']??'Cash'))?:'Cash';$date=trim((string)($p['date']??$p['paidAt']??''));$paidAt=$date!==''?$date.' 12:00:00':date('Y-m-d H:i:s');$receipt=trim((string)($p['receipt']??''));if($receipt==='')$receipt='MIG-'.date('Ymd').'-'.substr(hash('sha256',$ext),0,10);$voided=($p['voided']??false)===true;$voidedAt=$voided?(trim((string)($p['voidedAt']??''))?:date('Y-m-d H:i:s')):null;
      $st=$pdo->prepare('SELECT id FROM payments WHERE school_id=? AND (external_id=? OR receipt=?) ORDER BY id LIMIT 1');$st->execute([$schoolId,$ext,$receipt]);$pid=$st->fetchColumn()?:null;
      if(!$pid){$pdo->prepare('INSERT INTO payments(school_id,external_id,bill_id,student_id,amount,method,paid_at,receipt,voided,voided_at) VALUES(?,?,?,?,?,?,?,?,?,?)')->execute([$schoolId,$ext,$bid,$sid,$amount,$method,$paidAt,$receipt,$voided,$voidedAt]);}
      else{$pdo->prepare('UPDATE payments SET external_id=?,bill_id=?,student_id=?,amount=?,method=?,paid_at=?,receipt=?,voided=?,voided_at=? WHERE id=?')->execute([$ext,$bid,$sid,$amount,$method,$paidAt,$receipt,$voided,$voidedAt,$pid]);}
      $count['payments']++;
    }

    // 7. Rebuild guardian links from the now-complete student table. Existing credentials/status are preserved.
    $parentIds=$pdo->prepare("SELECT id FROM users WHERE school_id=? AND role='parent'");$parentIds->execute([$schoolId]);$ids=array_column($parentIds->fetchAll(),'id');
    if($ids){$pdo->prepare("DELETE FROM guardian_students WHERE guardian_user_id IN (SELECT id FROM users WHERE school_id=? AND role='parent')")->execute([$schoolId]);}
    $st=$pdo->prepare("SELECT guardian_phone,MAX(guardian_name) guardian_name FROM students WHERE school_id=? AND active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>'' GROUP BY guardian_phone");$st->execute([$schoolId]);
    foreach($st->fetchAll() as $g){
      $phone=phone48((string)$g['guardian_phone']);if($phone==='')continue;$name=trim((string)($g['guardian_name']??''))?:'Wali Murid';
      $q=$pdo->prepare("SELECT id,status FROM users WHERE school_id=? AND role='parent' AND username=? LIMIT 1");$q->execute([$schoolId,$phone]);$u=$q->fetch();
      if(!$u){$q=$pdo->prepare("INSERT INTO users(school_id,name,username,role,status,nickname) VALUES(?,?,?,'parent','not_invited',?) RETURNING id");$q->execute([$schoolId,$name,$phone,explode(' ',$name)[0]??$name]);$uid=(int)$q->fetchColumn();}
      else{$uid=(int)$u['id'];$pdo->prepare('UPDATE users SET name=?,updated_at=NOW() WHERE id=?')->execute([$name,$uid]);}
      $q=$pdo->prepare('SELECT id FROM students WHERE school_id=? AND active=TRUE AND guardian_phone=?');$q->execute([$schoolId,$phone]);foreach($q->fetchAll() as $s){$pdo->prepare('INSERT INTO guardian_students(guardian_user_id,student_id) VALUES(?,?) ON CONFLICT DO NOTHING')->execute([$uid,(int)$s['id']]);}
      $count['guardians']++;
    }

    $notes=['proof_files'=>'Only proof filename/status can be migrated from LocalStorage; binary proof files were never stored there.'];
    $st=$pdo->prepare('INSERT INTO data_migration_runs(school_id,user_id,source,source_fingerprint,classes_count,homerooms_count,students_count,fee_types_count,bills_count,payments_count,guardians_count,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING id');
    $st->execute([$schoolId,(int)$admin['id'],'browser-localstorage',$fingerprint?:null,$count['classes'],$count['homerooms'],$count['students'],$count['feeTypes'],$count['bills'],$count['payments'],$count['guardians'],json_encode($notes,JSON_UNESCAPED_UNICODE)]);$runId=(int)$st->fetchColumn();
    $pdo->commit();
    audit48($pdo,$schoolId,(int)$admin['id'],'migration.local_to_vps',['runId'=>$runId]+$count);
    r48(200,['ok'=>true,'message'=>'Migrasi seluruh data lokal ke VPS berhasil','runId'=>$runId,'counts'=>$count,'warning'=>'Nama/status bukti transfer berhasil dimigrasikan, tetapi file fisik tidak tersedia di LocalStorage sehingga tidak dapat dipindahkan otomatis.']);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();r48(500,['ok'=>false,'message'=>'Migrasi dibatalkan dan di-rollback: '.$e->getMessage()]);}
}

r48(404,['ok'=>false,'message'=>'Endpoint V4.8 tidak ditemukan']);
