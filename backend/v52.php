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

function r52(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function in52():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db52(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school52(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r52(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function staff52():array{if(empty($_SESSION['user']))r52(401,['ok'=>false,'message'=>'Belum login']);$u=$_SESSION['user'];if(!in_array($u['role']??'',['admin','finance'],true))r52(403,['ok'=>false,'message'=>'Akses khusus Admin/Finance']);return$u;}

$pdo=db52($config);$schoolId=school52($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v52/health'&&$method==='GET')r52(200,['ok'=>true,'version'=>'5.2','staff_notifications'=>true,'migration_menu'=>false]);

if($path==='/api/v52/notifications'&&$method==='GET'){
  $u=staff52();
  $q=$pdo->prepare("SELECT n.id,n.type,n.title,n.message,n.entity_type,n.entity_id,n.read_at,n.created_at,
    s.name student_name,b.title bill_title,b.status bill_status
    FROM notifications n
    LEFT JOIN students s ON s.id=n.student_id
    LEFT JOIN bills b ON n.entity_type='bill' AND b.id::text=n.entity_id
    WHERE n.school_id=? AND n.user_id=?
    ORDER BY n.created_at DESC,n.id DESC LIMIT 40");
  $q->execute([$schoolId,$u['id']]);$rows=[];$unread=0;
  foreach($q->fetchAll() as $n){if(empty($n['read_at']))$unread++;$rows[]=['id'=>(int)$n['id'],'type'=>$n['type'],'title'=>$n['title'],'message'=>$n['message'],'entityType'=>$n['entity_type'],'entityId'=>$n['entity_id'],'readAt'=>$n['read_at'],'createdAt'=>$n['created_at'],'studentName'=>$n['student_name'],'billTitle'=>$n['bill_title'],'billStatus'=>$n['bill_status']];}
  r52(200,['ok'=>true,'notifications'=>$rows,'unreadCount'=>$unread,'serverTime'=>date(DATE_ATOM)]);
}

if($path==='/api/v52/notifications/read'&&$method==='POST'){
  $u=staff52();$in=in52();$id=(int)($in['id']??0);
  if($id>0){$q=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND school_id=? AND user_id=?');$q->execute([$id,$schoolId,$u['id']]);}
  else{$q=$pdo->prepare('UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE school_id=? AND user_id=? AND read_at IS NULL');$q->execute([$schoolId,$u['id']]);}
  r52(200,['ok'=>true]);
}

r52(404,['ok'=>false,'message'=>'Endpoint V5.2 tidak ditemukan']);
