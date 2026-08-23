<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

function r501(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function input501():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db501(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school501(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r501(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function user501(array $roles=[]):array{if(empty($_SESSION['user']))r501(401,['ok'=>false,'message'=>'Sesi login berakhir. Silakan login kembali.']);$u=$_SESSION['user'];if($roles&&!in_array($u['role'],$roles,true))r501(403,['ok'=>false,'message'=>'Akses ditolak']);return$u;}
function phone501(string $v):string{$s=preg_replace('/[\s()\-]/','',trim($v));if(str_starts_with($s,'+62'))$s='0'.substr($s,3);elseif(str_starts_with($s,'62'))$s='0'.substr($s,2);return$s;}
function audit501(PDO $pdo,int $schoolId,?int $userId,string $action,array $meta=[]):void{$q=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?::jsonb,?,?)');$q->execute([$schoolId,$userId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function linkedStudents501(PDO $pdo,int $uid):array{$q=$pdo->prepare("SELECT s.id,s.external_id,s.nis,s.name,c.name class_name FROM guardian_students gs JOIN students s ON s.id=gs.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE gs.guardian_user_id=? AND s.active=TRUE ORDER BY s.name");$q->execute([$uid]);$rows=$q->fetchAll();foreach($rows as &$r)$r['id']=(int)$r['id'];unset($r);return$rows;}
function repairGuardianLinks501(PDO $pdo,int $schoolId,array $u):int{
  $phone=phone501((string)($u['username']??''));if($phone==='')return 0;
  $q=$pdo->prepare("SELECT id,guardian_phone FROM students WHERE school_id=? AND active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>''");$q->execute([$schoolId]);$matches=[];
  foreach($q->fetchAll() as $s)if(phone501((string)$s['guardian_phone'])===$phone)$matches[]=(int)$s['id'];
  if(!$matches)return 0;$ins=$pdo->prepare('INSERT INTO guardian_students(guardian_user_id,student_id) VALUES(?,?) ON CONFLICT DO NOTHING');$n=0;
  foreach($matches as $sid){$ins->execute([(int)$u['id'],$sid]);$n+=$ins->rowCount();}
  if($n)audit501($pdo,$schoolId,(int)$u['id'],'guardian.links_auto_repaired',['student_ids'=>$matches,'phone'=>$phone]);
  return$n;
}
function notify501(PDO $pdo,int $schoolId,int $studentId,string $type,string $title,string $message,string $entityId):void{$q=$pdo->prepare('SELECT guardian_user_id FROM guardian_students WHERE student_id=?');$q->execute([$studentId]);$ins=$pdo->prepare("INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,?,?,'bill',?)");foreach($q->fetchAll() as $g)$ins->execute([$schoolId,(int)$g['guardian_user_id'],$studentId,$type,$title,$message,$entityId]);}

$pdo=db501($config);$schoolId=school501($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v501/health'&&$method==='GET')r501(200,['ok'=>true,'version'=>'5.0.1','parent_state'=>true,'guardian_repair'=>true]);

if($path==='/api/v501/parent/state'&&$method==='GET'){
  $u=user501(['parent']);$uid=(int)$u['id'];$students=linkedStudents501($pdo,$uid);
  if(!$students){repairGuardianLinks501($pdo,$schoolId,$u);$students=linkedStudents501($pdo,$uid);}
  if(!$students)r501(409,['ok'=>false,'code'=>'NO_STUDENT_LINK','message'=>'Akun wali aktif, tetapi belum terhubung ke siswa. Minta Admin menjalankan Sinkronkan Akun Wali.']);
  $requested=isset($_GET['student_id'])?(int)$_GET['student_id']:0;$allowed=array_map(fn($x)=>(int)$x['id'],$students);$studentId=in_array($requested,$allowed,true)?$requested:0;
  if(!$studentId&&$requested>0){foreach($students as $s){if((string)($s['external_id']??'')===(string)$requested){$studentId=(int)$s['id'];break;}}}
  if(!$studentId)$studentId=(int)$students[0]['id'];
  $q=$pdo->prepare("SELECT b.id,b.external_id,b.student_id,b.title,b.amount,b.due_date,b.status,b.payment_method,b.proof_name,b.updated_at,s.name student_name,c.name class_name FROM bills b JOIN students s ON s.id=b.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE b.school_id=? AND b.student_id=? ORDER BY b.due_date NULLS LAST,b.id DESC");$q->execute([$schoolId,$studentId]);$bills=[];
  foreach($q->fetchAll() as $b)$bills[]=['id'=>(int)$b['id'],'externalId'=>$b['external_id'],'studentId'=>(int)$b['student_id'],'studentName'=>$b['student_name'],'className'=>$b['class_name'],'title'=>$b['title'],'amount'=>(float)$b['amount'],'due'=>$b['due_date'],'status'=>$b['status'],'paymentMethod'=>$b['payment_method'],'proofName'=>$b['proof_name'],'updatedAt'=>$b['updated_at']];
  $sum=['unpaid'=>0.0,'paid'=>0.0,'pending'=>0,'count'=>0];foreach($bills as $b){if($b['status']==='cancelled')continue;$sum['count']++;if($b['status']==='unpaid')$sum['unpaid']+=$b['amount'];elseif($b['status']==='paid')$sum['paid']+=$b['amount'];elseif($b['status']==='pending')$sum['pending']++;}
  $q=$pdo->prepare('SELECT name,salutation,nickname FROM users WHERE id=? AND school_id=?');$q->execute([$uid,$schoolId]);$p=$q->fetch();$nickname=trim((string)($p['nickname']??''));if($nickname==='')$nickname=explode(' ',trim((string)$p['name']))[0]??'Wali';
  $q=$pdo->prepare('SELECT id,type,title,message,read_at,created_at FROM notifications WHERE school_id=? AND user_id=? ORDER BY created_at DESC LIMIT 30');$q->execute([$schoolId,$uid]);$notifications=$q->fetchAll();foreach($notifications as &$n)$n['id']=(int)$n['id'];unset($n);$unread=count(array_filter($notifications,fn($n)=>empty($n['read_at'])));
  r501(200,['ok'=>true,'profile'=>['name'=>$p['name'],'salutation'=>$p['salutation']?:'Bapak/Ibu','nickname'=>$nickname],'studentId'=>$studentId,'students'=>$students,'bills'=>$bills,'summary'=>$sum,'notifications'=>$notifications,'unreadCount'=>$unread,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v501/parent/notifications/read'&&$method==='POST'){
  $u=user501(['parent']);$in=input501();$id=(int)($in['id']??0);if($id){$q=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE school_id=? AND id=? AND user_id=?');$q->execute([$schoolId,$id,(int)$u['id']]);}else{$q=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE school_id=? AND user_id=?');$q->execute([$schoolId,(int)$u['id']]);}r501(200,['ok'=>true]);
}

if(preg_match('#^/api/v501/parent/bills/(\d+)/proof$#',$path,$m)&&$method==='POST'){
  $u=user501(['parent']);$billId=(int)$m[1];$in=input501();$proof=trim((string)($in['proofName']??''));if($proof==='')r501(422,['ok'=>false,'message'=>'Pilih bukti pembayaran terlebih dahulu']);
  $q=$pdo->prepare("SELECT b.* FROM bills b JOIN guardian_students gs ON gs.student_id=b.student_id WHERE b.school_id=? AND b.id=? AND gs.guardian_user_id=? LIMIT 1");$q->execute([$schoolId,$billId,(int)$u['id']]);$b=$q->fetch();if(!$b)r501(404,['ok'=>false,'message'=>'Tagihan tidak ditemukan atau tidak terhubung dengan akun ini']);if($b['status']!=='unpaid')r501(409,['ok'=>false,'message'=>'Status tagihan sudah berubah. Refresh halaman terlebih dahulu.']);
  $pdo->prepare("UPDATE bills SET status='pending',payment_method='Transfer',proof_name=?,updated_at=NOW() WHERE id=?")->execute([$proof,$billId]);notify501($pdo,$schoolId,(int)$b['student_id'],'payment_pending','Bukti pembayaran dikirim','Bukti pembayaran '.$b['title'].' telah dikirim dan menunggu verifikasi.',(string)$billId);audit501($pdo,$schoolId,(int)$u['id'],'proof.submitted',['bill_id'=>$billId,'proof_name'=>$proof]);r501(200,['ok'=>true,'message'=>'Bukti pembayaran menunggu verifikasi']);
}

if($path==='/api/v501/admin/guardians'&&$method==='GET'){
  user501(['admin']);
  $q=$pdo->prepare("SELECT u.id,u.name,u.username,u.status,u.salutation,u.nickname,u.locked_until,u.activated_at,u.last_login_at,(SELECT MAX(t.created_at) FROM activation_tokens t WHERE t.user_id=u.id) last_invite_at,COALESCE(json_agg(json_build_object('id',s.id,'name',s.name,'nis',s.nis,'className',c.name) ORDER BY s.name) FILTER(WHERE s.id IS NOT NULL),'[]'::json) students FROM users u LEFT JOIN guardian_students gs ON gs.guardian_user_id=u.id LEFT JOIN students s ON s.id=gs.student_id AND s.active=TRUE LEFT JOIN classes c ON c.id=s.class_id WHERE u.school_id=? AND u.role='parent' GROUP BY u.id ORDER BY u.name,u.id");$q->execute([$schoolId]);$rows=$q->fetchAll();
  foreach($rows as &$r){$r['id']=(int)$r['id'];if(is_string($r['students']))$r['students']=json_decode($r['students'],true)?:[];if(!$r['nickname'])$r['nickname']=explode(' ',trim($r['name']))[0]??$r['name'];}unset($r);
  $counts=['parents'=>count($rows)];$c=$pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id=? AND active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>''");$c->execute([$schoolId]);$counts['studentsWithGuardianPhone']=(int)$c->fetchColumn();
  r501(200,['ok'=>true,'guardians'=>$rows,'counts'=>$counts,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v501/admin/guardians/sync'&&$method==='POST'){
  $admin=user501(['admin']);$q=$pdo->prepare("SELECT id,guardian_name,guardian_phone FROM students WHERE school_id=? AND active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>'' ORDER BY id");$q->execute([$schoolId]);$students=$q->fetchAll();$created=0;$linked=0;$updated=0;
  $pdo->beginTransaction();try{
    foreach($students as $s){$phone=phone501((string)$s['guardian_phone']);if($phone==='')continue;$q=$pdo->prepare("SELECT id FROM users WHERE school_id=? AND role='parent' AND username=? LIMIT 1");$q->execute([$schoolId,$phone]);$uid=$q->fetchColumn();$name=trim((string)$s['guardian_name'])?:'Wali Murid';
      if(!$uid){$ins=$pdo->prepare("INSERT INTO users(school_id,name,username,role,status) VALUES(?,?,?,'parent','not_invited') RETURNING id");$ins->execute([$schoolId,$name,$phone]);$uid=$ins->fetchColumn();$created++;}else{$pdo->prepare('UPDATE users SET name=?,updated_at=NOW() WHERE id=?')->execute([$name,$uid]);$updated++;}
      $ins=$pdo->prepare('INSERT INTO guardian_students(guardian_user_id,student_id) VALUES(?,?) ON CONFLICT DO NOTHING');$ins->execute([$uid,$s['id']]);$linked+=$ins->rowCount();
    }
    $pdo->commit();
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw$e;}
  audit501($pdo,$schoolId,(int)$admin['id'],'guardian.sync_v501',['created'=>$created,'updated'=>$updated,'linked'=>$linked]);r501(200,['ok'=>true,'created'=>$created,'updated'=>$updated,'linked'=>$linked]);
}

if(preg_match('#^/api/v501/admin/guardians/(\d+)/profile$#',$path,$m)&&$method==='POST'){
  user501(['admin']);$in=input501();$sal=$in['salutation']??null;$nick=trim((string)($in['nickname']??''));if(!in_array($sal,['Bapak','Ibu'],true))r501(422,['ok'=>false,'message'=>'Sapaan harus Bapak atau Ibu']);if($nick==='')r501(422,['ok'=>false,'message'=>'Nama panggilan wajib diisi']);$q=$pdo->prepare("UPDATE users SET salutation=?,nickname=?,updated_at=NOW() WHERE id=? AND school_id=? AND role='parent'");$q->execute([$sal,$nick,(int)$m[1],$schoolId]);if(!$q->rowCount())r501(404,['ok'=>false,'message'=>'Akun wali tidak ditemukan']);r501(200,['ok'=>true,'message'=>'Sapaan wali diperbarui']);
}

r501(404,['ok'=>false,'message'=>'Endpoint V5.0.1 tidak ditemukan']);
