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

function r49(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function in49():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db49(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school49(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$st=$pdo->prepare('SELECT id FROM schools WHERE code=?');$st->execute([$code]);$id=$st->fetchColumn();if($id)return(int)$id;r49(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);}
function user49(array $roles=[]):array{if(empty($_SESSION['user']))r49(401,['ok'=>false,'message'=>'Belum login']);$u=$_SESSION['user'];if($roles&&!in_array($u['role'],$roles,true))r49(403,['ok'=>false,'message'=>'Akses ditolak']);return$u;}
function phone49(string $v):string{$s=preg_replace('/[\s()\-]/','',trim($v));if(str_starts_with($s,'+62'))$s='0'.substr($s,3);elseif(str_starts_with($s,'62'))$s='0'.substr($s,2);return$s;}
function audit49(PDO $pdo,int $schoolId,int $userId,string $action,array $meta=[]):void{$st=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?::jsonb,?,?)');$st->execute([$schoolId,$userId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function notify49(PDO $pdo,int $schoolId,int $studentId,string $type,string $title,string $message,string $entityId):void{
  $q=$pdo->prepare('SELECT guardian_user_id FROM guardian_students WHERE student_id=?');$q->execute([$studentId]);
  $ins=$pdo->prepare("INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,?,?,'bill',?)");
  foreach($q->fetchAll() as $g)$ins->execute([$schoolId,(int)$g['guardian_user_id'],$studentId,$type,$title,$message,$entityId]);
}
function localId49(?string $external,int $serverId):int|string{
  $e=trim((string)$external);if($e!==''&&preg_match('/^-?\d+$/',$e))return(int)$e;return$serverId;
}
function scalar49(PDO $pdo,string $sql,array $args=[]):int{$q=$pdo->prepare($sql);$q->execute($args);return(int)$q->fetchColumn();}

$pdo=db49($config);$schoolId=school49($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v49/health'&&$method==='GET')r49(200,['ok'=>true,'version'=>'4.9','server_snapshot'=>true,'full_operational_sync'=>true]);

if($path==='/api/v49/state'&&$method==='GET'){
  $u=user49(['admin','finance']);
  $classes=[];$homerooms=[];$students=[];$fees=[];
  if($u['role']==='admin'){
    $q=$pdo->prepare("SELECT c.id,c.external_id,c.name,c.level,c.academic_year,c.active,h.external_id homeroom_external_id,h.id homeroom_server_id
      FROM classes c LEFT JOIN homeroom_teachers h ON h.id=c.homeroom_teacher_id WHERE c.school_id=? ORDER BY c.name");$q->execute([$schoolId]);
    foreach($q->fetchAll() as $x)$classes[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'name'=>$x['name'],'level'=>$x['level']??'','academicYear'=>$x['academic_year']??'','active'=>(bool)$x['active'],'homeroomTeacherId'=>$x['homeroom_server_id']?localId49($x['homeroom_external_id'],(int)$x['homeroom_server_id']):null];

    $q=$pdo->prepare('SELECT id,external_id,nip,name,phone,email,active FROM homeroom_teachers WHERE school_id=? ORDER BY active DESC,name');$q->execute([$schoolId]);
    foreach($q->fetchAll() as $x)$homerooms[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'serverExternalId'=>$x['external_id'],'nip'=>$x['nip']??'','name'=>$x['name'],'phone'=>$x['phone']??'','email'=>$x['email']??'','active'=>(bool)$x['active']];

    $q=$pdo->prepare("SELECT s.id,s.external_id,s.nis,s.name,s.guardian_name,s.guardian_phone,s.active,c.id class_server_id,c.external_id class_external_id
      FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.school_id=? ORDER BY s.name");$q->execute([$schoolId]);
    foreach($q->fetchAll() as $x)$students[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'nis'=>$x['nis'],'name'=>$x['name'],'classId'=>$x['class_server_id']?localId49($x['class_external_id'],(int)$x['class_server_id']):null,'parent'=>$x['guardian_name']??'','phone'=>$x['guardian_phone']??'','active'=>(bool)$x['active']];

    $q=$pdo->prepare('SELECT id,external_id,name,amount,period,active FROM fee_types WHERE school_id=? ORDER BY name');$q->execute([$schoolId]);
    foreach($q->fetchAll() as $x)$fees[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'name'=>$x['name'],'amount'=>(float)$x['amount'],'period'=>$x['period']??'','active'=>(bool)$x['active']];
  }

  $bills=[];
  $q=$pdo->prepare("SELECT b.id,b.external_id,b.title,b.amount,b.due_date,b.status,b.payment_method,b.proof_name,b.updated_at,
    s.id student_server_id,s.external_id student_external_id,s.name student_name,c.name class_name
    FROM bills b JOIN students s ON s.id=b.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE b.school_id=? ORDER BY b.id DESC");$q->execute([$schoolId]);
  foreach($q->fetchAll() as $x)$bills[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'externalId'=>$x['external_id'],'studentId'=>localId49($x['student_external_id'],(int)$x['student_server_id']),'studentName'=>$x['student_name'],'className'=>$x['class_name'],'title'=>$x['title'],'amount'=>(float)$x['amount'],'due'=>$x['due_date'],'status'=>$x['status'],'paymentMethod'=>$x['payment_method'],'proofName'=>$x['proof_name'],'updatedAt'=>$x['updated_at']];

  $payments=[];
  $q=$pdo->prepare("SELECT p.id,p.external_id,p.amount,p.method,p.paid_at,p.receipt,p.voided,p.voided_at,b.id bill_server_id,b.external_id bill_external_id,
    s.id student_server_id,s.external_id student_external_id,u.name verified_name
    FROM payments p JOIN bills b ON b.id=p.bill_id JOIN students s ON s.id=p.student_id LEFT JOIN users u ON u.id=p.verified_by
    WHERE p.school_id=? ORDER BY p.paid_at DESC,p.id DESC");$q->execute([$schoolId]);
  foreach($q->fetchAll() as $x)$payments[]=['id'=>localId49($x['external_id'],(int)$x['id']),'serverId'=>(int)$x['id'],'externalId'=>$x['external_id'],'billId'=>localId49($x['bill_external_id'],(int)$x['bill_server_id']),'studentId'=>localId49($x['student_external_id'],(int)$x['student_server_id']),'amount'=>(float)$x['amount'],'method'=>$x['method'],'date'=>substr((string)$x['paid_at'],0,10),'paidAt'=>$x['paid_at'],'verifiedBy'=>$x['verified_name']??'','receipt'=>$x['receipt'],'voided'=>(bool)$x['voided'],'voidedAt'=>$x['voided_at']];

  $counts=['classes'=>scalar49($pdo,'SELECT COUNT(*) FROM classes WHERE school_id=?',[$schoolId]),'homerooms'=>scalar49($pdo,'SELECT COUNT(*) FROM homeroom_teachers WHERE school_id=?',[$schoolId]),'students'=>scalar49($pdo,'SELECT COUNT(*) FROM students WHERE school_id=?',[$schoolId]),'feeTypes'=>scalar49($pdo,'SELECT COUNT(*) FROM fee_types WHERE school_id=?',[$schoolId]),'bills'=>count($bills),'payments'=>count($payments)];
  r49(200,['ok'=>true,'role'=>$u['role'],'classes'=>$classes,'homeroomTeachers'=>$homerooms,'students'=>$students,'feeTypes'=>$fees,'bills'=>$bills,'payments'=>$payments,'counts'=>$counts,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v49/sync-all'&&$method==='POST'){
  $u=user49(['admin','finance']);$in=in49();$isAdmin=$u['role']==='admin';
  $classes=$isAdmin&&is_array($in['classes']??null)?$in['classes']:[];
  $homerooms=$isAdmin&&is_array($in['homeroomTeachers']??null)?$in['homeroomTeachers']:[];
  $students=$isAdmin&&is_array($in['students']??null)?$in['students']:[];
  $fees=$isAdmin&&is_array($in['feeTypes']??null)?$in['feeTypes']:[];
  $bills=is_array($in['bills']??null)?$in['bills']:[];
  $payments=is_array($in['payments']??null)?$in['payments']:[];
  $counts=['classes'=>0,'homerooms'=>0,'students'=>0,'feeTypes'=>0,'billsCreated'=>0,'billsUpdated'=>0,'payments'=>0,'skipped'=>0];

  $pdo->beginTransaction();
  try{
    if($isAdmin){
      // Classes first, without teacher assignment.
      foreach($classes as $c){$ext=trim((string)($c['id']??$c['externalId']??''));$name=trim((string)($c['name']??''));if($name===''){continue;}$level=trim((string)($c['level']??''));$year=trim((string)($c['academicYear']??''));$active=($c['active']??true)!==false;$cid=null;
        if($ext!==''){$q=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$ext]);$cid=$q->fetchColumn()?:null;}
        if(!$cid){$q=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND name=? AND academic_year IS NOT DISTINCT FROM ? ORDER BY id DESC LIMIT 1');$q->execute([$schoolId,$name,$year?:null]);$cid=$q->fetchColumn()?:null;}
        if(!$cid){$q=$pdo->prepare('INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(?,?,?,?,?,?) RETURNING id');$q->execute([$schoolId,$ext?:null,$name,$level?:null,$year?:null,$active]);$cid=$q->fetchColumn();}
        else{$pdo->prepare('UPDATE classes SET external_id=COALESCE(?,external_id),name=?,level=?,academic_year=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$name,$level?:null,$year?:null,$active,$cid]);}$counts['classes']++;}

      foreach($homerooms as $t){$ext=trim((string)($t['id']??$t['externalId']??''));$name=trim((string)($t['name']??''));if($name==='')continue;$nip=trim((string)($t['nip']??''));$phone=phone49((string)($t['phone']??''));$email=trim((string)($t['email']??''));$active=($t['active']??true)!==false;$tid=null;
        if($ext!==''){$q=$pdo->prepare('SELECT id FROM homeroom_teachers WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$ext]);$tid=$q->fetchColumn()?:null;}
        if(!$tid&&$nip!==''){$q=$pdo->prepare('SELECT id FROM homeroom_teachers WHERE school_id=? AND nip=? LIMIT 1');$q->execute([$schoolId,$nip]);$tid=$q->fetchColumn()?:null;}
        if(!$tid){$q=$pdo->prepare('INSERT INTO homeroom_teachers(school_id,external_id,nip,name,phone,email,active) VALUES(?,?,?,?,?,?,?) RETURNING id');$q->execute([$schoolId,$ext?:null,$nip?:null,$name,$phone?:null,$email?:null,$active]);$tid=$q->fetchColumn();}
        else{$pdo->prepare('UPDATE homeroom_teachers SET external_id=COALESCE(?,external_id),nip=?,name=?,phone=?,email=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$nip?:null,$name,$phone?:null,$email?:null,$active,$tid]);}$counts['homerooms']++;}

      // Teacher assignment uses external IDs.
      foreach($classes as $c){$cext=trim((string)($c['id']??$c['externalId']??''));if($cext==='')continue;$tidExt=trim((string)($c['homeroomTeacherId']??''));$tid=null;if($tidExt!==''){$q=$pdo->prepare('SELECT id FROM homeroom_teachers WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$tidExt]);$tid=$q->fetchColumn()?:null;}$q=$pdo->prepare('UPDATE classes SET homeroom_teacher_id=?,updated_at=NOW() WHERE school_id=? AND external_id=?');$q->execute([$tid,$schoolId,$cext]);}

      foreach($students as $s){$ext=trim((string)($s['id']??$s['externalId']??''));$nis=trim((string)($s['nis']??''));$name=trim((string)($s['name']??''));if($nis===''||$name==='')continue;$classExt=trim((string)($s['classId']??''));$cid=null;if($classExt!==''){$q=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$classExt]);$cid=$q->fetchColumn()?:null;}$parent=trim((string)($s['parent']??$s['guardianName']??''));$phone=phone49((string)($s['phone']??$s['guardianPhone']??''));$active=($s['active']??true)!==false;
        $q=$pdo->prepare("INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(school_id,nis) DO UPDATE SET external_id=EXCLUDED.external_id,name=EXCLUDED.name,class_id=EXCLUDED.class_id,guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,active=EXCLUDED.active,updated_at=NOW()");$q->execute([$schoolId,$ext?:null,$nis,$name,$cid,$parent?:null,$phone?:null,$active]);$counts['students']++;}

      foreach($fees as $f){$ext=trim((string)($f['id']??$f['externalId']??''));$name=trim((string)($f['name']??''));if($name==='')continue;$amount=(float)($f['amount']??0);$period=trim((string)($f['period']??''));$active=($f['active']??true)!==false;$fid=null;
        if($ext!==''){$q=$pdo->prepare('SELECT id FROM fee_types WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$ext]);$fid=$q->fetchColumn()?:null;}
        if(!$fid){$q=$pdo->prepare('SELECT id FROM fee_types WHERE school_id=? AND name=? LIMIT 1');$q->execute([$schoolId,$name]);$fid=$q->fetchColumn()?:null;}
        if(!$fid){$pdo->prepare('INSERT INTO fee_types(school_id,external_id,name,amount,period,active) VALUES(?,?,?,?,?,?)')->execute([$schoolId,$ext?:null,$name,$amount,$period?:null,$active]);}
        else{$pdo->prepare('UPDATE fee_types SET external_id=COALESCE(?,external_id),name=?,amount=?,period=?,active=?,updated_at=NOW() WHERE id=?')->execute([$ext?:null,$name,$amount,$period?:null,$active,$fid]);}$counts['feeTypes']++;}
    }

    // Bills for Admin and Finance.
    foreach($bills as $b){$ext=trim((string)($b['id']??$b['externalId']??''));$studentExt=trim((string)($b['studentId']??''));if($ext===''||$studentExt===''){$counts['skipped']++;continue;}$q=$pdo->prepare('SELECT id FROM students WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$studentExt]);$sid=$q->fetchColumn()?:null;if(!$sid){$counts['skipped']++;continue;}
      $title=trim((string)($b['title']??'Tagihan'));$amount=(float)($b['amount']??0);$due=trim((string)($b['due']??$b['dueDate']??''))?:null;$status=(string)($b['status']??'unpaid');if(!in_array($status,['unpaid','pending','paid','cancelled'],true))$status='unpaid';$payMethod=trim((string)($b['paymentMethod']??''))?:null;$proof=trim((string)($b['proofName']??''))?:null;
      $q=$pdo->prepare('SELECT * FROM bills WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$ext]);$old=$q->fetch();
      if(!$old){$q=$pdo->prepare('INSERT INTO bills(school_id,external_id,student_id,title,amount,due_date,status,payment_method,proof_name) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id');$q->execute([$schoolId,$ext,$sid,$title,$amount,$due,$status,$payMethod,$proof]);$bid=(int)$q->fetchColumn();$counts['billsCreated']++;notify49($pdo,$schoolId,(int)$sid,'bill_new','Tagihan baru',"Tagihan {$title} sebesar Rp ".number_format($amount,0,',','.')." telah ditambahkan.",(string)$bid);}
      else{$bid=(int)$old['id'];$changed=$old['title']!==$title||(float)$old['amount']!==$amount||$old['due_date']!==$due||$old['status']!==$status||$old['payment_method']!==$payMethod||$old['proof_name']!==$proof;if(!$changed)continue;$pdo->prepare('UPDATE bills SET student_id=?,title=?,amount=?,due_date=?,status=?,payment_method=?,proof_name=?,updated_at=NOW() WHERE id=?')->execute([$sid,$title,$amount,$due,$status,$payMethod,$proof,$bid]);$counts['billsUpdated']++;
        if($old['status']!==$status){$map=['paid'=>['payment_paid','Pembayaran diterima',"Pembayaran {$title} telah dikonfirmasi lunas."],'pending'=>['payment_pending','Menunggu verifikasi',"Bukti pembayaran {$title} sedang diverifikasi."],'cancelled'=>['bill_cancelled','Tagihan dibatalkan',"Tagihan {$title} telah dibatalkan."],'unpaid'=>['bill_unpaid','Status tagihan diperbarui',"Tagihan {$title} berstatus belum dibayar."]];[$tp,$ti,$msg]=$map[$status];notify49($pdo,$schoolId,(int)$sid,$tp,$ti,$msg,(string)$bid);}
        else notify49($pdo,$schoolId,(int)$sid,'bill_updated','Tagihan diperbarui',"Informasi tagihan {$title} telah diperbarui.",(string)$bid);}
    }

    foreach($payments as $p){$ext=trim((string)($p['id']??$p['externalId']??''));$billExt=trim((string)($p['billId']??''));$studentExt=trim((string)($p['studentId']??''));if($billExt===''||$studentExt===''){$counts['skipped']++;continue;}$q=$pdo->prepare('SELECT id FROM bills WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$billExt]);$bid=$q->fetchColumn()?:null;$q=$pdo->prepare('SELECT id FROM students WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$studentExt]);$sid=$q->fetchColumn()?:null;if(!$bid||!$sid){$counts['skipped']++;continue;}
      $receipt=trim((string)($p['receipt']??''));if($receipt===''){$counts['skipped']++;continue;}if($ext==='')$ext='receipt:'.$receipt;$amount=(float)($p['amount']??0);$methodPay=trim((string)($p['method']??'Cash'))?:'Cash';$date=trim((string)($p['paidAt']??$p['date']??''));$paidAt=$date!==''?(strlen($date)<=10?$date.' 12:00:00':$date):date('Y-m-d H:i:s');$voided=($p['voided']??false)===true;$voidedAt=$p['voidedAt']??null;
      $q=$pdo->prepare('SELECT id FROM payments WHERE school_id=? AND (external_id=? OR receipt=?) LIMIT 1');$q->execute([$schoolId,$ext,$receipt]);$pid=$q->fetchColumn()?:null;
      if(!$pid){$q=$pdo->prepare('INSERT INTO payments(school_id,external_id,bill_id,student_id,amount,method,paid_at,verified_by,receipt,voided,voided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');$q->execute([$schoolId,$ext,$bid,$sid,$amount,$methodPay,$paidAt,(int)$u['id'],$receipt,$voided,$voidedAt]);}
      else{$q=$pdo->prepare('UPDATE payments SET bill_id=?,student_id=?,amount=?,method=?,paid_at=?,verified_by=COALESCE(verified_by,?),receipt=?,voided=?,voided_at=? WHERE id=?');$q->execute([$bid,$sid,$amount,$methodPay,$paidAt,(int)$u['id'],$receipt,$voided,$voidedAt,$pid]);}$counts['payments']++;}

    $pdo->commit();audit49($pdo,$schoolId,(int)$u['id'],'operational.sync.v49',$counts);
    r49(200,['ok'=>true,'counts'=>$counts,'serverTime'=>date(DATE_ATOM)]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();r49(500,['ok'=>false,'message'=>'Sinkronisasi server gagal: '.$e->getMessage()]);}
}

r49(404,['ok'=>false,'message'=>'Endpoint V4.9 tidak ditemukan']);
