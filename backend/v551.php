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

function r551(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function db551(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school551(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r551(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function user551():array{if(empty($_SESSION['user']))r551(401,['ok'=>false,'message'=>'Sesi login tidak ditemukan. Silakan login kembali.']);return $_SESSION['user'];}

$pdo=db551($config);$schoolId=school551($pdo,$config);$u=user551();$role=(string)($u['role']??'');
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';
if($path==='/api/v551/health'&&$method==='GET')r551(200,['ok'=>true,'version'=>'5.5.1','portal_state'=>true]);
if($path!=='/api/v551/portal/state'||$method!=='GET')r551(404,['ok'=>false,'message'=>'Endpoint V5.5.1 tidak ditemukan']);

if(in_array($role,['admin','finance'],true)){
  $q=$pdo->prepare("SELECT
    COALESCE(SUM(amount) FILTER (WHERE status<>'cancelled'),0) total_billed,
    COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) paid_amount,
    COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) unpaid_amount,
    COALESCE(SUM(amount) FILTER (WHERE status='pending'),0) pending_amount,
    COUNT(*) FILTER (WHERE status='pending') pending_count,
    COUNT(*) FILTER (WHERE status='unpaid' AND due_date<CURRENT_DATE) overdue_count
    FROM bills WHERE school_id=?");
  $q->execute([$schoolId]);$bill=$q->fetch()?:[];

  $q=$pdo->prepare("SELECT
    COALESCE(SUM(amount) FILTER (WHERE voided=FALSE AND paid_at::date=CURRENT_DATE),0) today,
    COALESCE(SUM(amount) FILTER (WHERE voided=FALSE AND date_trunc('month',paid_at)=date_trunc('month',CURRENT_DATE)),0) month
    FROM payments WHERE school_id=?");
  $q->execute([$schoolId]);$pay=$q->fetch()?:[];

  $q=$pdo->prepare("SELECT
    (SELECT COUNT(*) FROM students WHERE school_id=? AND active=TRUE) active_students,
    (SELECT COUNT(*) FROM users WHERE school_id=? AND role='parent' AND status='active') active_guardians,
    (SELECT COUNT(*) FROM classes WHERE school_id=? AND active=TRUE) active_classes,
    (SELECT COUNT(*) FROM bills WHERE school_id=?) bill_count,
    (SELECT COUNT(*) FROM payments WHERE school_id=?) payment_count");
  $q->execute([$schoolId,$schoolId,$schoolId,$schoolId,$schoolId]);$people=$q->fetch()?:[];

  $q=$pdo->prepare("SELECT p.id,p.receipt,p.amount,p.method,p.paid_at,p.voided,s.name student_name,b.title
    FROM payments p JOIN students s ON s.id=p.student_id JOIN bills b ON b.id=p.bill_id
    WHERE p.school_id=? ORDER BY p.paid_at DESC,p.id DESC LIMIT 5");
  $q->execute([$schoolId]);$latest=[];
  foreach($q->fetchAll() as $r)$latest[]=['id'=>(int)$r['id'],'receipt'=>$r['receipt'],'amount'=>(float)$r['amount'],'method'=>$r['method'],'paidAt'=>$r['paid_at'],'voided'=>(bool)$r['voided'],'studentName'=>$r['student_name'],'title'=>$r['title']];

  r551(200,[
    'ok'=>true,'version'=>'5.5.1','role'=>$role,'schoolId'=>$schoolId,
    'dashboard'=>[
      'summary'=>[
        'totalBilled'=>(float)($bill['total_billed']??0),'paid'=>(float)($bill['paid_amount']??0),'unpaid'=>(float)($bill['unpaid_amount']??0),
        'pendingAmount'=>(float)($bill['pending_amount']??0),'pendingCount'=>(int)($bill['pending_count']??0),'overdueCount'=>(int)($bill['overdue_count']??0),
        'today'=>(float)($pay['today']??0),'month'=>(float)($pay['month']??0),'activeStudents'=>(int)($people['active_students']??0),'activeGuardians'=>(int)($people['active_guardians']??0)
      ],
      'latestPayments'=>$latest,'serverTime'=>date(DATE_ATOM)
    ],
    'databaseCounts'=>['students'=>(int)($people['active_students']??0),'classes'=>(int)($people['active_classes']??0),'bills'=>(int)($people['bill_count']??0),'payments'=>(int)($people['payment_count']??0)]
  ]);
}

if($role==='parent'){
  $uid=(int)($u['id']??0);
  $q=$pdo->prepare("SELECT s.id,s.nis,s.name,c.name class_name,s.guardian_name,s.guardian_phone
    FROM guardian_students gs JOIN students s ON s.id=gs.student_id LEFT JOIN classes c ON c.id=s.class_id
    WHERE gs.guardian_user_id=? AND s.school_id=? AND s.active=TRUE ORDER BY s.name,s.id");
  $q->execute([$uid,$schoolId]);$students=[];
  foreach($q->fetchAll() as $r)$students[]=['id'=>(int)$r['id'],'nis'=>$r['nis'],'name'=>$r['name'],'class_name'=>$r['class_name']??'','className'=>$r['class_name']??'','guardian_name'=>$r['guardian_name']??'','guardian_phone'=>$r['guardian_phone']??''];
  if(!$students)r551(200,['ok'=>true,'version'=>'5.5.1','role'=>'parent','parentState'=>['students'=>[],'studentId'=>null,'profile'=>['name'=>$u['name']??'Wali','salutation'=>'Bapak/Ibu','nickname'=>null],'bills'=>[],'summary'=>['unpaid'=>0,'paid'=>0,'pending'=>0,'count'=>0],'notifications'=>[],'unreadCount'=>0,'serverTime'=>date(DATE_ATOM)],'warning'=>'Akun wali belum terhubung ke siswa aktif.']);

  $requested=(int)($_GET['student_id']??0);$ids=array_column($students,'id');$studentId=in_array($requested,$ids,true)?$requested:(int)$students[0]['id'];
  $q=$pdo->prepare("SELECT id,title,amount,due_date,status,payment_method,proof_name,updated_at FROM bills WHERE school_id=? AND student_id=? AND status<>'cancelled' ORDER BY due_date NULLS LAST,id DESC");
  $q->execute([$schoolId,$studentId]);$bills=[];$summary=['unpaid'=>0.0,'paid'=>0.0,'pending'=>0.0,'count'=>0];
  foreach($q->fetchAll() as $r){$row=['id'=>(int)$r['id'],'title'=>$r['title'],'amount'=>(float)$r['amount'],'due'=>$r['due_date'],'status'=>$r['status'],'paymentMethod'=>$r['payment_method'],'proofName'=>$r['proof_name'],'updatedAt'=>$r['updated_at']];$bills[]=$row;$summary['count']++;if($r['status']==='unpaid')$summary['unpaid']+=(float)$r['amount'];elseif($r['status']==='paid')$summary['paid']+=(float)$r['amount'];elseif($r['status']==='pending')$summary['pending']+=(float)$r['amount'];}

  $q=$pdo->prepare("SELECT name,salutation,nickname FROM users WHERE id=? AND school_id=?");$q->execute([$uid,$schoolId]);$profile=$q->fetch()?:[];
  $q=$pdo->prepare("SELECT id,type,title,message,entity_type,entity_id,read_at,created_at FROM notifications WHERE school_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 30");$q->execute([$schoolId,$uid]);$notifications=$q->fetchAll();$unread=0;foreach($notifications as &$n){$n['id']=(int)$n['id'];if(empty($n['read_at']))$unread++;}unset($n);

  r551(200,['ok'=>true,'version'=>'5.5.1','role'=>'parent','schoolId'=>$schoolId,'parentState'=>[
    'students'=>$students,'studentId'=>$studentId,
    'profile'=>['name'=>$profile['name']??($u['name']??'Wali'),'salutation'=>$profile['salutation']??'Bapak/Ibu','nickname'=>$profile['nickname']??null],
    'bills'=>$bills,'summary'=>$summary,'notifications'=>$notifications,'unreadCount'=>$unread,'serverTime'=>date(DATE_ATOM)
  ],'databaseCounts'=>['linkedStudents'=>count($students),'bills'=>count($bills)]]);
}

r551(403,['ok'=>false,'message'=>'Role akun tidak dikenali']);
