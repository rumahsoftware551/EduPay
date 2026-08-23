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

function v44Respond(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function v44Input():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function v44Db(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function v44User(array $roles=[]):array{if(empty($_SESSION['user']))v44Respond(401,['ok'=>false,'message'=>'Belum login']);$u=$_SESSION['user'];if($roles&&!in_array($u['role'],$roles,true))v44Respond(403,['ok'=>false,'message'=>'Akses ditolak']);return $u;}
function v44School(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$s=$pdo->prepare('SELECT id FROM schools WHERE code=?');$s->execute([$code]);$id=$s->fetchColumn();if(!$id)v44Respond(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function v44NotifyGuardians(PDO $pdo,int $schoolId,int $studentId,string $type,string $title,string $message,?string $entityId=null):void{
  $s=$pdo->prepare('SELECT guardian_user_id FROM guardian_students WHERE student_id=?');$s->execute([$studentId]);
  $ins=$pdo->prepare("INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,? ,?,'bill',?)");
  foreach($s->fetchAll() as $r)$ins->execute([$schoolId,(int)$r['guardian_user_id'],$studentId,$type,$title,$message,$entityId]);
}
function v44StudentByExternal(PDO $pdo,int $schoolId,string $external):?array{$s=$pdo->prepare('SELECT * FROM students WHERE school_id=? AND external_id=? LIMIT 1');$s->execute([$schoolId,$external]);$r=$s->fetch();return$r?:null;}
function v44BillPayload(array $r):array{return['id'=>(int)$r['id'],'externalId'=>$r['external_id'],'studentId'=>(int)$r['student_id'],'studentName'=>$r['student_name']??null,'className'=>$r['class_name']??null,'title'=>$r['title'],'amount'=>(float)$r['amount'],'due'=>$r['due_date'],'status'=>$r['status'],'paymentMethod'=>$r['payment_method'],'proofName'=>$r['proof_name'],'updatedAt'=>$r['updated_at']];}

$pdo=v44Db($config);$schoolId=v44School($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v44/health'&&$method==='GET')v44Respond(200,['ok'=>true,'version'=>'4.4','realtime'=>true]);

if($path==='/api/v44/admin/guardians'&&$method==='GET'){
  v44User(['admin']);
  $s=$pdo->prepare("SELECT u.id,u.name,u.username,u.status,u.salutation,u.nickname,u.locked_until,u.activated_at,u.last_login_at,
  (SELECT MAX(t.created_at) FROM activation_tokens t WHERE t.user_id=u.id) last_invite_at,
  COALESCE(json_agg(json_build_object('id',st.id,'name',st.name,'nis',st.nis,'className',c.name) ORDER BY st.name) FILTER(WHERE st.id IS NOT NULL),'[]'::json) students
  FROM users u LEFT JOIN guardian_students gs ON gs.guardian_user_id=u.id LEFT JOIN students st ON st.id=gs.student_id AND st.active=TRUE LEFT JOIN classes c ON c.id=st.class_id
  WHERE u.school_id=? AND u.role='parent' GROUP BY u.id ORDER BY u.name,u.id");$s->execute([$schoolId]);$rows=$s->fetchAll();
  foreach($rows as &$r){$r['id']=(int)$r['id'];if(is_string($r['students']))$r['students']=json_decode($r['students'],true)?:[];if(!$r['nickname'])$r['nickname']=explode(' ',trim($r['name']))[0]??$r['name'];}unset($r);
  v44Respond(200,['ok'=>true,'guardians'=>$rows]);
}

if(preg_match('#^/api/v44/admin/guardians/(\d+)/profile$#',$path,$m)&&$method==='POST'){
  v44User(['admin']);$in=v44Input();$sal=$in['salutation']??null;$nick=trim((string)($in['nickname']??''));
  if(!in_array($sal,['Bapak','Ibu'],true))v44Respond(422,['ok'=>false,'message'=>'Sapaan harus Bapak atau Ibu']);if($nick==='')v44Respond(422,['ok'=>false,'message'=>'Nama panggilan wajib diisi']);
  $s=$pdo->prepare("UPDATE users SET salutation=?,nickname=?,updated_at=NOW() WHERE id=? AND school_id=? AND role='parent'");$s->execute([$sal,$nick,(int)$m[1],$schoolId]);if(!$s->rowCount())v44Respond(404,['ok'=>false,'message'=>'Akun wali tidak ditemukan']);
  v44Respond(200,['ok'=>true,'message'=>'Sapaan wali diperbarui']);
}

if($path==='/api/v44/admin/operational/sync'&&$method==='POST'){
  v44User(['admin','finance']);$in=v44Input();$bills=$in['bills']??[];$created=0;$updated=0;
  $pdo->beginTransaction();try{
    foreach($bills as $b){$external=(string)($b['id']??'');$st=v44StudentByExternal($pdo,$schoolId,(string)($b['studentId']??''));if(!$st)continue;
      $q=$pdo->prepare('SELECT * FROM bills WHERE school_id=? AND external_id=? LIMIT 1');$q->execute([$schoolId,$external]);$old=$q->fetch();
      $title=trim((string)($b['title']??'Tagihan'));$amount=(float)($b['amount']??0);$due=($b['due']??null)?:null;$status=(string)($b['status']??'unpaid');if(!in_array($status,['unpaid','pending','paid','cancelled'],true))$status='unpaid';
      $methodPay=$b['paymentMethod']??null;$proof=$b['proofName']??null;
      if(!$old){$ins=$pdo->prepare('INSERT INTO bills(school_id,external_id,student_id,title,amount,due_date,status,payment_method,proof_name) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id');$ins->execute([$schoolId,$external,$st['id'],$title,$amount,$due,$status,$methodPay,$proof]);$bid=(int)$ins->fetchColumn();$created++;v44NotifyGuardians($pdo,$schoolId,(int)$st['id'],'bill_new','Tagihan baru',"Tagihan {$title} sebesar Rp ".number_format($amount,0,',','.')." telah ditambahkan.",(string)$bid);continue;}
      $changed=$old['title']!==$title||(float)$old['amount']!==$amount||$old['due_date']!==$due||$old['status']!==$status||$old['payment_method']!==$methodPay||$old['proof_name']!==$proof;
      if(!$changed)continue;
      $pdo->prepare('UPDATE bills SET student_id=?,title=?,amount=?,due_date=?,status=?,payment_method=?,proof_name=?,updated_at=NOW() WHERE id=?')->execute([$st['id'],$title,$amount,$due,$status,$methodPay,$proof,$old['id']]);$updated++;
      if($old['status']!==$status){$map=['paid'=>['payment_paid','Pembayaran diterima',"Pembayaran {$title} telah dikonfirmasi lunas."],'pending'=>['payment_pending','Menunggu verifikasi',"Bukti pembayaran {$title} sedang diverifikasi."],'cancelled'=>['bill_cancelled','Tagihan dibatalkan',"Tagihan {$title} telah dibatalkan."],'unpaid'=>['bill_unpaid','Status tagihan diperbarui',"Tagihan {$title} berstatus belum dibayar."]];[$tp,$ti,$msg]=$map[$status];v44NotifyGuardians($pdo,$schoolId,(int)$st['id'],$tp,$ti,$msg,(string)$old['id']);}
      else v44NotifyGuardians($pdo,$schoolId,(int)$st['id'],'bill_updated','Tagihan diperbarui',"Informasi tagihan {$title} telah diperbarui.",(string)$old['id']);
    }
    $pdo->commit();
  }catch(Throwable $e){$pdo->rollBack();throw$e;}
  v44Respond(200,['ok'=>true,'created'=>$created,'updated'=>$updated]);
}

if($path==='/api/v44/parent/state'&&$method==='GET'){
  $u=v44User(['parent']);$uid=(int)$u['id'];$requested=isset($_GET['student_id'])?(int)$_GET['student_id']:0;
  $s=$pdo->prepare("SELECT st.id,st.nis,st.name,c.name class_name FROM guardian_students gs JOIN students st ON st.id=gs.student_id LEFT JOIN classes c ON c.id=st.class_id WHERE gs.guardian_user_id=? AND st.active=TRUE ORDER BY st.name");$s->execute([$uid]);$students=$s->fetchAll();foreach($students as &$st)$st['id']=(int)$st['id'];unset($st);if(!$students)v44Respond(404,['ok'=>false,'message'=>'Akun belum terhubung ke siswa aktif']);
  $allowed=array_column($students,'id');$studentId=in_array($requested,$allowed,true)?$requested:(int)($u['studentId']??$students[0]['id']);if(!in_array($studentId,$allowed,true))$studentId=(int)$students[0]['id'];
  $q=$pdo->prepare("SELECT b.*,st.name student_name,c.name class_name FROM bills b JOIN students st ON st.id=b.student_id LEFT JOIN classes c ON c.id=st.class_id WHERE b.school_id=? AND b.student_id=? ORDER BY b.due_date NULLS LAST,b.id DESC");$q->execute([$schoolId,$studentId]);$rows=$q->fetchAll();$bills=array_map('v44BillPayload',$rows);
  $sum=['unpaid'=>0.0,'paid'=>0.0,'pending'=>0,'count'=>0];foreach($bills as $b){if($b['status']==='cancelled')continue;$sum['count']++;if($b['status']==='unpaid')$sum['unpaid']+=$b['amount'];if($b['status']==='paid')$sum['paid']+=$b['amount'];if($b['status']==='pending')$sum['pending']++;}
  $q=$pdo->prepare('SELECT salutation,nickname,name FROM users WHERE id=?');$q->execute([$uid]);$profile=$q->fetch();$nickname=trim((string)($profile['nickname']??''))?:explode(' ',trim((string)$profile['name']))[0];$salutation=$profile['salutation']?:'Bapak/Ibu';
  $q=$pdo->prepare('SELECT id,type,title,message,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20');$q->execute([$uid]);$notifications=$q->fetchAll();foreach($notifications as &$n)$n['id']=(int)$n['id'];unset($n);$unread=count(array_filter($notifications,fn($n)=>empty($n['read_at'])));
  v44Respond(200,['ok'=>true,'profile'=>['salutation'=>$salutation,'nickname'=>$nickname,'name'=>$profile['name']],'studentId'=>$studentId,'students'=>$students,'bills'=>$bills,'summary'=>$sum,'notifications'=>$notifications,'unreadCount'=>$unread,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v44/parent/notifications/read'&&$method==='POST'){
  $u=v44User(['parent']);$in=v44Input();$id=(int)($in['id']??0);if($id){$s=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND user_id=?');$s->execute([$id,(int)$u['id']]);}else{$s=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=?');$s->execute([(int)$u['id']]);}v44Respond(200,['ok'=>true]);
}

if(preg_match('#^/api/v44/parent/bills/(\d+)/proof$#',$path,$m)&&$method==='POST'){
  $u=v44User(['parent']);$billId=(int)$m[1];$in=v44Input();$proof=trim((string)($in['proofName']??''));if($proof==='')v44Respond(422,['ok'=>false,'message'=>'Nama bukti pembayaran wajib ada']);
  $s=$pdo->prepare("SELECT b.* FROM bills b JOIN guardian_students gs ON gs.student_id=b.student_id WHERE b.id=? AND gs.guardian_user_id=? AND b.school_id=?");$s->execute([$billId,(int)$u['id'],$schoolId]);$b=$s->fetch();if(!$b)v44Respond(404,['ok'=>false,'message'=>'Tagihan tidak ditemukan']);if($b['status']!=='unpaid')v44Respond(409,['ok'=>false,'message'=>'Tagihan tidak dalam status belum bayar']);
  $pdo->prepare("UPDATE bills SET status='pending',payment_method='Transfer',proof_name=?,updated_at=NOW() WHERE id=?")->execute([$proof,$billId]);v44NotifyGuardians($pdo,$schoolId,(int)$b['student_id'],'payment_pending','Bukti pembayaran dikirim',"Bukti pembayaran {$b['title']} telah dikirim dan menunggu verifikasi.",(string)$billId);v44Respond(200,['ok'=>true,'message'=>'Bukti pembayaran menunggu verifikasi']);
}

v44Respond(404,['ok'=>false,'message'=>'Endpoint V4.4 tidak ditemukan']);
