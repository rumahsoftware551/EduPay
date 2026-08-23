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

function r50(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function input50():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db50(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school50(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r50(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);return(int)$id;}
function finance50():array{if(empty($_SESSION['user']))r50(401,['ok'=>false,'message'=>'Belum login']);$u=$_SESSION['user'];if(($u['role']??'')!=='finance')r50(403,['ok'=>false,'message'=>'Akses khusus Finance/Bendahara']);return$u;}
function audit50(PDO $pdo,int $schoolId,int $userId,string $action,string $entityType,string $entityId,array $meta=[]):void{$q=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES(?,?,?,?,?,?::jsonb,?,?)');$q->execute([$schoolId,$userId,$action,$entityType,$entityId,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function notifyStudent50(PDO $pdo,int $schoolId,int $studentId,string $type,string $title,string $message,string $entityType,string $entityId):void{
  $q=$pdo->prepare('SELECT guardian_user_id FROM guardian_students WHERE student_id=?');$q->execute([$studentId]);
  $ins=$pdo->prepare('INSERT INTO notifications(school_id,user_id,student_id,type,title,message,entity_type,entity_id) VALUES(?,?,?,?,?,?,?,?)');
  foreach($q->fetchAll() as $g)$ins->execute([$schoolId,(int)$g['guardian_user_id'],$studentId,$type,$title,$message,$entityType,$entityId]);
}
function nextReceipt50(PDO $pdo,int $schoolId):string{
  $q=$pdo->prepare("INSERT INTO receipt_counters(school_id,counter_date,last_number) VALUES(?,CURRENT_DATE,1)
    ON CONFLICT(school_id,counter_date) DO UPDATE SET last_number=receipt_counters.last_number+1,updated_at=NOW()
    RETURNING counter_date,last_number");
  $q->execute([$schoolId]);$r=$q->fetch();
  return 'PAY-'.date('Ymd',strtotime((string)$r['counter_date'])).'-'.str_pad((string)$r['last_number'],5,'0',STR_PAD_LEFT);
}
function billLock50(PDO $pdo,int $schoolId,int $billId):array{
  $q=$pdo->prepare("SELECT b.*,s.name student_name FROM bills b JOIN students s ON s.id=b.student_id WHERE b.school_id=? AND b.id=? FOR UPDATE OF b");
  $q->execute([$schoolId,$billId]);$b=$q->fetch();if(!$b)r50(404,['ok'=>false,'message'=>'Tagihan tidak ditemukan di server']);return$b;
}
function activePaymentForBill50(PDO $pdo,int $billId):?array{$q=$pdo->prepare('SELECT * FROM payments WHERE bill_id=? AND voided=FALSE ORDER BY id DESC LIMIT 1');$q->execute([$billId]);$p=$q->fetch();return$p?:null;}
function createPayment50(PDO $pdo,int $schoolId,array $u,array $bill,string $method):array{
  if($bill['status']==='cancelled')r50(409,['ok'=>false,'message'=>'Tagihan sudah dibatalkan']);
  if($bill['status']==='paid'||activePaymentForBill50($pdo,(int)$bill['id']))r50(409,['ok'=>false,'message'=>'Tagihan sudah dibayar/diproses oleh petugas lain']);
  $receipt=nextReceipt50($pdo,$schoolId);
  $external='server:'.$receipt;
  $q=$pdo->prepare('INSERT INTO payments(school_id,external_id,bill_id,student_id,amount,method,paid_at,verified_by,receipt,voided) VALUES(?,?,?,?,?,?,NOW(),?,?,FALSE) RETURNING id,paid_at');
  $q->execute([$schoolId,$external,$bill['id'],$bill['student_id'],$bill['amount'],$method,$u['id'],$receipt]);$p=$q->fetch();
  $pdo->prepare('UPDATE bills SET status=\'paid\',payment_method=?,updated_at=NOW() WHERE id=?')->execute([$method,$bill['id']]);
  audit50($pdo,$schoolId,(int)$u['id'],'payment.created','payment',(string)$p['id'],['bill_id'=>(int)$bill['id'],'receipt'=>$receipt,'method'=>$method,'amount'=>(float)$bill['amount']]);
  notifyStudent50($pdo,$schoolId,(int)$bill['student_id'],'payment','Pembayaran dikonfirmasi','Pembayaran '.$bill['title'].' sebesar Rp '.number_format((float)$bill['amount'],0,',','.').' telah dikonfirmasi lunas.','payment',(string)$p['id']);
  return ['id'=>(int)$p['id'],'receipt'=>$receipt,'paid_at'=>$p['paid_at'],'amount'=>(float)$bill['amount'],'method'=>$method];
}

$pdo=db50($config);$schoolId=school50($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v50/health'&&$method==='GET')r50(200,['ok'=>true,'version'=>'5.0','finance_server_first'=>true,'atomic_payments'=>true]);

if(preg_match('#^/api/v50/finance/bills/(\d+)/pay$#',$path,$m)&&$method==='POST'){
  $u=finance50();$in=input50();$billId=(int)$m[1];$payMethod=trim((string)($in['method']??'Cash'));
  if(!in_array($payMethod,['Cash','Transfer','QRIS'],true))r50(422,['ok'=>false,'message'=>'Metode pembayaran tidak valid']);
  $pdo->beginTransaction();
  try{$bill=billLock50($pdo,$schoolId,$billId);$payment=createPayment50($pdo,$schoolId,$u,$bill,$payMethod);$pdo->commit();r50(200,['ok'=>true,'message'=>'Pembayaran berhasil dicatat','payment'=>$payment]);}
  catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException)r50(500,['ok'=>false,'message'=>'Transaksi database gagal']);throw$e;}
}

if(preg_match('#^/api/v50/finance/bills/(\d+)/approve$#',$path,$m)&&$method==='POST'){
  $u=finance50();$billId=(int)$m[1];
  $pdo->beginTransaction();
  try{
    $bill=billLock50($pdo,$schoolId,$billId);
    if($bill['status']!=='pending')r50(409,['ok'=>false,'message'=>'Tagihan tidak lagi menunggu verifikasi']);
    if(trim((string)$bill['proof_name'])==='')r50(409,['ok'=>false,'message'=>'Bukti transfer belum tersedia']);
    $payment=createPayment50($pdo,$schoolId,$u,$bill,'Transfer');$pdo->commit();r50(200,['ok'=>true,'message'=>'Bukti diterima dan pembayaran dilunaskan','payment'=>$payment]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException)r50(500,['ok'=>false,'message'=>'Transaksi database gagal']);throw$e;}
}

if(preg_match('#^/api/v50/finance/bills/(\d+)/reject$#',$path,$m)&&$method==='POST'){
  $u=finance50();$in=input50();$reason=trim((string)($in['reason']??''));$billId=(int)$m[1];
  if(mb_strlen($reason)<3)r50(422,['ok'=>false,'message'=>'Alasan penolakan wajib diisi minimal 3 karakter']);
  $pdo->beginTransaction();
  try{
    $bill=billLock50($pdo,$schoolId,$billId);
    if($bill['status']!=='pending')r50(409,['ok'=>false,'message'=>'Tagihan tidak lagi menunggu verifikasi']);
    $pdo->prepare("UPDATE bills SET status='unpaid',payment_method=NULL,proof_name=NULL,updated_at=NOW() WHERE id=?")->execute([$billId]);
    audit50($pdo,$schoolId,(int)$u['id'],'proof.rejected','bill',(string)$billId,['reason'=>$reason,'old_proof'=>$bill['proof_name']]);
    notifyStudent50($pdo,$schoolId,(int)$bill['student_id'],'warning','Bukti pembayaran ditolak','Bukti untuk '.$bill['title'].' ditolak. Alasan: '.$reason,'bill',(string)$billId);
    $pdo->commit();r50(200,['ok'=>true,'message'=>'Bukti pembayaran ditolak']);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException)r50(500,['ok'=>false,'message'=>'Transaksi database gagal']);throw$e;}
}

if(preg_match('#^/api/v50/finance/payments/(\d+)/void$#',$path,$m)&&$method==='POST'){
  $u=finance50();$in=input50();$reason=trim((string)($in['reason']??''));$paymentId=(int)$m[1];
  if(mb_strlen($reason)<5)r50(422,['ok'=>false,'message'=>'Alasan pembatalan wajib diisi minimal 5 karakter']);
  $pdo->beginTransaction();
  try{
    $q=$pdo->prepare('SELECT * FROM payments WHERE school_id=? AND id=? FOR UPDATE');$q->execute([$schoolId,$paymentId]);$p=$q->fetch();if(!$p)r50(404,['ok'=>false,'message'=>'Pembayaran tidak ditemukan']);
    if((bool)$p['voided'])r50(409,['ok'=>false,'message'=>'Pembayaran sudah dibatalkan sebelumnya']);
    $bill=billLock50($pdo,$schoolId,(int)$p['bill_id']);
    $pdo->prepare('UPDATE payments SET voided=TRUE,voided_at=NOW(),void_reason=?,voided_by=? WHERE id=?')->execute([$reason,$u['id'],$paymentId]);
    $pdo->prepare("UPDATE bills SET status='unpaid',payment_method=NULL,proof_name=NULL,updated_at=NOW() WHERE id=?")->execute([$bill['id']]);
    audit50($pdo,$schoolId,(int)$u['id'],'payment.voided','payment',(string)$paymentId,['receipt'=>$p['receipt'],'reason'=>$reason,'bill_id'=>(int)$bill['id']]);
    notifyStudent50($pdo,$schoolId,(int)$bill['student_id'],'warning','Pembayaran dibatalkan','Pembayaran '.$bill['title'].' dengan kwitansi '.$p['receipt'].' dibatalkan oleh sekolah. Silakan hubungi petugas bila diperlukan.','payment',(string)$paymentId);
    $pdo->commit();r50(200,['ok'=>true,'message'=>'Pembayaran berhasil dibatalkan','receipt'=>$p['receipt']]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException)r50(500,['ok'=>false,'message'=>'Transaksi database gagal']);throw$e;}
}

r50(404,['ok'=>false,'message'=>'Endpoint V5.0 tidak ditemukan']);
