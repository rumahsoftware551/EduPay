<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
$storageRoot='/var/lib/edupay/proofs';
header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

function j51(int $status,array $data):never{http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function db51(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school51(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)j51(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function user51():array{if(empty($_SESSION['user']))j51(401,['ok'=>false,'message'=>'Belum login']);return $_SESSION['user'];}
function audit51(PDO $pdo,int $schoolId,int $userId,string $action,string $entityType,string $entityId,array $meta=[]):void{$q=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES(?,?,?,?,?,?::jsonb,?,?)');$q->execute([$schoolId,$userId,$action,$entityType,$entityId,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function notify51(PDO $pdo,int $schoolId,int $studentId,string $type,string $title,string $message,string $entityId):void{$q=$pdo->prepare('SELECT guardian_user_id FROM guardian_students WHERE student_id=?');$q->execute([$studentId]);$ins=$pdo->prepare("INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,?,?,'bill',?)");foreach($q->fetchAll() as $g)$ins->execute([$schoolId,(int)$g['guardian_user_id'],$studentId,$type,$title,$message,$entityId]);}
function safeOriginal51(string $name):string{$base=basename($name);$base=preg_replace('/[^A-Za-z0-9._ -]/','_',$base);return mb_substr($base?:'bukti-transfer',0,180);}
function canAccessProof51(PDO $pdo,int $schoolId,array $u,int $billId):array{
  if(in_array($u['role']??'',['admin','finance'],true)){$q=$pdo->prepare('SELECT b.* FROM bills b WHERE b.school_id=? AND b.id=?');$q->execute([$schoolId,$billId]);$b=$q->fetch();if(!$b)j51(404,['ok'=>false,'message'=>'Tagihan tidak ditemukan']);return$b;}
  if(($u['role']??'')==='parent'){$q=$pdo->prepare('SELECT b.* FROM bills b JOIN guardian_students gs ON gs.student_id=b.student_id WHERE b.school_id=? AND b.id=? AND gs.guardian_user_id=?');$q->execute([$schoolId,$billId,$u['id']]);$b=$q->fetch();if(!$b)j51(403,['ok'=>false,'message'=>'Akses bukti ditolak']);return$b;}
  j51(403,['ok'=>false,'message'=>'Akses ditolak']);
}

$pdo=db51($config);$schoolId=school51($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v51/health'&&$method==='GET')j51(200,['ok'=>true,'version'=>'5.1','private_proof_storage'=>true,'max_mb'=>5]);

if(preg_match('#^/api/v51/parent/bills/(\d+)/proof$#',$path,$m)&&$method==='POST'){
  $u=user51();if(($u['role']??'')!=='parent')j51(403,['ok'=>false,'message'=>'Akses khusus wali murid']);$billId=(int)$m[1];
  if(empty($_FILES['proof'])||!is_array($_FILES['proof']))j51(422,['ok'=>false,'message'=>'File bukti pembayaran belum dipilih']);
  $f=$_FILES['proof'];if(($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)j51(422,['ok'=>false,'message'=>'Upload file gagal']);
  $size=(int)($f['size']??0);if($size<=0||$size>5*1024*1024)j51(422,['ok'=>false,'message'=>'Ukuran bukti maksimal 5 MB']);
  $tmp=(string)$f['tmp_name'];$fi=new finfo(FILEINFO_MIME_TYPE);$mime=$fi->file($tmp)?:'';$allowed=['image/jpeg'=>'jpg','image/png'=>'png','application/pdf'=>'pdf'];if(!isset($allowed[$mime]))j51(422,['ok'=>false,'message'=>'Format bukti harus JPG, PNG, atau PDF']);
  $q=$pdo->prepare("SELECT b.*,s.name student_name FROM bills b JOIN guardian_students gs ON gs.student_id=b.student_id JOIN students s ON s.id=b.student_id WHERE b.school_id=? AND b.id=? AND gs.guardian_user_id=?");$q->execute([$schoolId,$billId,$u['id']]);$b=$q->fetch();if(!$b)j51(404,['ok'=>false,'message'=>'Tagihan tidak ditemukan']);if($b['status']!=='unpaid')j51(409,['ok'=>false,'message'=>'Tagihan tidak dalam status belum bayar']);
  $rel=$schoolId.'/'.date('Y').'/'.date('m');$dir=$storageRoot.'/'.$rel;if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))j51(500,['ok'=>false,'message'=>'Storage bukti belum siap']);
  $key=$rel.'/'.bin2hex(random_bytes(24)).'.'.$allowed[$mime];$dest=$storageRoot.'/'.$key;if(!move_uploaded_file($tmp,$dest))j51(500,['ok'=>false,'message'=>'Gagal menyimpan bukti ke VPS']);@chmod($dest,0640);
  $original=safeOriginal51((string)($f['name']??'bukti-transfer'));
  $pdo->beginTransaction();
  try{
    $pdo->prepare("UPDATE bills SET status='pending',payment_method='Transfer',proof_name=?,proof_storage_key=?,proof_mime=?,proof_size=?,proof_uploaded_at=NOW(),updated_at=NOW() WHERE id=?")->execute([$original,$key,$mime,$size,$billId]);
    audit51($pdo,$schoolId,(int)$u['id'],'proof.uploaded','bill',(string)$billId,['name'=>$original,'mime'=>$mime,'size'=>$size]);
    notify51($pdo,$schoolId,(int)$b['student_id'],'payment_pending','Bukti pembayaran dikirim','Bukti pembayaran '.$b['title'].' telah diunggah dan menunggu verifikasi.',(string)$billId);
    $pdo->commit();
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();@unlink($dest);throw$e;}
  j51(200,['ok'=>true,'message'=>'Bukti pembayaran berhasil disimpan di VPS dan menunggu verifikasi']);
}

if(preg_match('#^/api/v51/proofs/(\d+)$#',$path,$m)&&$method==='GET'){
  $u=user51();$billId=(int)$m[1];$b=canAccessProof51($pdo,$schoolId,$u,$billId);$key=trim((string)($b['proof_storage_key']??''));if($key==='')j51(404,['ok'=>false,'message'=>'File bukti belum tersimpan di VPS']);
  $full=$storageRoot.'/'.$key;$realRoot=realpath($storageRoot);$real=realpath($full);if(!$realRoot||!$real||!str_starts_with($real,$realRoot.DIRECTORY_SEPARATOR)||!is_file($real))j51(404,['ok'=>false,'message'=>'File bukti tidak ditemukan']);
  $mime=(string)($b['proof_mime']??'application/octet-stream');$name=safeOriginal51((string)($b['proof_name']??'bukti-transfer'));
  header('Content-Type: '.$mime);header('Content-Length: '.filesize($real));header('Content-Disposition: inline; filename="'.addcslashes($name,'"\\').'"');header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store, max-age=0');readfile($real);exit;
}

j51(404,['ok'=>false,'message'=>'Endpoint V5.1 tidak ditemukan']);
