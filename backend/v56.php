<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();

const V56_BRANDING_DIR='/var/lib/edupay/branding';
const V56_PROOF_DIR='/var/lib/edupay/proofs';
const V56_MAINT_DIR='/var/lib/edupay/maintenance';

function r56(int $status,array $data):never{http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function db56(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function schoolId56(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$id=$q->fetchColumn();if(!$id)r56(500,['ok'=>false,'message'=>'Sekolah aktif tidak ditemukan']);return(int)$id;}
function user56():array{if(empty($_SESSION['user']))r56(401,['ok'=>false,'message'=>'Belum login']);return $_SESSION['user'];}
function admin56():array{$u=user56();if(($u['role']??'')!=='admin')r56(403,['ok'=>false,'message'=>'Akses khusus Administrator']);return$u;}
function input56():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function audit56(PDO $pdo,int $schoolId,int $uid,string $action,string $type,string $id,array $meta=[]):void{$q=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,entity_type,entity_id,metadata,ip_address,user_agent) VALUES(?,?,?,?,?,?::jsonb,?,?)');$q->execute([$schoolId,$uid,$action,$type,$id,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}
function h56(mixed $v):string{return htmlspecialchars((string)($v??''),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function rupiah56(float $v):string{return 'Rp '.number_format($v,0,',','.');}
function fileStats56(string $dir):array{$count=0;$bytes=0;if(!is_dir($dir))return['count'=>0,'bytes'=>0,'exists'=>false];$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS));foreach($it as$f){if($f->isFile()){$count++;$bytes+=$f->getSize();}}return['count'=>$count,'bytes'=>$bytes,'exists'=>true];}
function jsonFile56(string $file):?array{if(!is_file($file))return null;$d=json_decode((string)@file_get_contents($file),true);return is_array($d)?$d:null;}
function schoolRow56(PDO $pdo,int $id):array{$q=$pdo->prepare('SELECT id,code,name,npsn,address,phone,email,principal_name,treasurer_name,bank_name,bank_account,bank_account_name,qris_info,academic_year_current,semester_current,support_email,app_name,logo_url,logo_storage_key,logo_mime,logo_updated_at,receipt_prefix,receipt_footer,backup_retention_days,updated_at FROM schools WHERE id=?');$q->execute([$id]);return$q->fetch()?:[];}
function logoPath56(array $school):?string{$key=basename((string)($school['logo_storage_key']??''));if($key==='')return null;$path=V56_BRANDING_DIR.'/'.$key;return is_file($path)?$path:null;}

$pdo=db56($config);$schoolId=schoolId56($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v56/health'&&$method==='GET')r56(200,['ok'=>true,'version'=>'5.6','commercial_master'=>true,'backup'=>true,'branding'=>true,'official_receipts'=>true]);

if($path==='/api/v56/branding'&&$method==='GET'){
  $s=schoolRow56($pdo,$schoolId);$logo=logoPath56($s);
  r56(200,['ok'=>true,'appName'=>$s['app_name']?:'EduPay','schoolName'=>$s['name']?:'Sekolah EduPay','logoUrl'=>$logo?'/api/v1/branding/logo?v='.rawurlencode((string)($s['logo_updated_at']??time())):($s['logo_url']?:null),'supportEmail'=>$s['support_email']?:null]);
}
if($path==='/api/v56/branding/logo'&&$method==='GET'){
  $s=schoolRow56($pdo,$schoolId);$file=logoPath56($s);if(!$file){http_response_code(404);exit;}
  $mime=(string)($s['logo_mime']?:'image/png');header('Content-Type: '.$mime);header('Content-Length: '.filesize($file));header('Cache-Control: public, max-age=3600');header('ETag: "'.sha1_file($file).'"');readfile($file);exit;
}

if($path==='/api/v56/admin/maintenance'&&$method==='GET'){
  admin56();$school=schoolRow56($pdo,$schoolId);$proof=fileStats56(V56_PROOF_DIR);$brand=fileStats56(V56_BRANDING_DIR);$backup=jsonFile56(V56_MAINT_DIR.'/backup-status.json');$restore=jsonFile56(V56_MAINT_DIR.'/restore-status.json');
  $q=$pdo->prepare("SELECT (SELECT COUNT(*) FROM students WHERE school_id=?) students,(SELECT COUNT(*) FROM bills WHERE school_id=?) bills,(SELECT COUNT(*) FROM payments WHERE school_id=?) payments,(SELECT COUNT(*) FROM users WHERE school_id=? AND role='parent') guardians");$q->execute([$schoolId,$schoolId,$schoolId,$schoolId]);$counts=$q->fetch()?:[];
  $dbSize=(int)$pdo->query('SELECT pg_database_size(current_database())')->fetchColumn();
  r56(200,['ok'=>true,'version'=>'5.6','backup'=>$backup,'restoreVerification'=>$restore,'storage'=>['databaseBytes'=>$dbSize,'proofs'=>$proof,'branding'=>$brand],'counts'=>array_map('intval',$counts),'settings'=>['receiptPrefix'=>$school['receipt_prefix']?:'PAY','receiptFooter'=>$school['receipt_footer']??'','backupRetentionDays'=>(int)($school['backup_retention_days']??30),'logoUrl'=>$school['logo_url']??null]]);
}

if($path==='/api/v56/admin/readiness'&&$method==='GET'){
  admin56();$s=schoolRow56($pdo,$schoolId);$backup=jsonFile56(V56_MAINT_DIR.'/backup-status.json');$lastTs=isset($backup['finished_at'])?strtotime((string)$backup['finished_at']):false;$recent=$lastTs!==false&&(time()-$lastTs)<172800;
  $checks=[
    ['key'=>'school_name','label'=>'Nama sekolah','pass'=>trim((string)$s['name'])!=='','required'=>true],
    ['key'=>'academic_year','label'=>'Tahun ajaran aktif','pass'=>trim((string)$s['academic_year_current'])!=='','required'=>true],
    ['key'=>'support_email','label'=>'Email support','pass'=>filter_var($s['support_email']??'',FILTER_VALIDATE_EMAIL)!==false,'required'=>true],
    ['key'=>'receipt_prefix','label'=>'Prefix kwitansi','pass'=>preg_match('/^[A-Z0-9-]{2,16}$/',(string)$s['receipt_prefix'])===1,'required'=>true],
    ['key'=>'backup_recent','label'=>'Backup sukses < 48 jam','pass'=>$recent,'required'=>true],
    ['key'=>'logo','label'=>'Logo sekolah','pass'=>logoPath56($s)!==null||trim((string)($s['logo_url']??''))!=='','required'=>false],
    ['key'=>'restore_verified','label'=>'Restore rehearsal pernah PASS','pass'=>($restore['ok']??false)===true,'required'=>true],
  ];
  $required=array_values(array_filter($checks,fn($c)=>$c['required']));$passed=count(array_filter($required,fn($c)=>$c['pass']));$score=$required?(int)round($passed/count($required)*100):100;
  r56(200,['ok'=>true,'score'=>$score,'ready'=>$score===100,'checks'=>$checks]);
}

if($path==='/api/v56/admin/settings'&&$method==='POST'){
  $u=admin56();$in=input56();$prefix=strtoupper(trim((string)($in['receiptPrefix']??'PAY')));$prefix=preg_replace('/[^A-Z0-9-]/','',$prefix)?:'PAY';$footer=trim((string)($in['receiptFooter']??''));$ret=(int)($in['backupRetentionDays']??30);
  if(!preg_match('/^[A-Z0-9-]{2,16}$/',$prefix))r56(422,['ok'=>false,'message'=>'Prefix kwitansi harus 2-16 karakter A-Z, angka, atau tanda -']);
  if(mb_strlen($footer)>500)r56(422,['ok'=>false,'message'=>'Footer kwitansi maksimal 500 karakter']);if($ret<7||$ret>365)r56(422,['ok'=>false,'message'=>'Retensi backup harus 7-365 hari']);
  $q=$pdo->prepare('UPDATE schools SET receipt_prefix=?,receipt_footer=?,backup_retention_days=?,updated_at=NOW() WHERE id=?');$q->execute([$prefix,$footer?:null,$ret,$schoolId]);audit56($pdo,$schoolId,(int)$u['id'],'commercial.settings.updated','school',(string)$schoolId,['receipt_prefix'=>$prefix,'retention_days'=>$ret]);r56(200,['ok'=>true,'message'=>'Pengaturan Commercial Master disimpan','settings'=>['receiptPrefix'=>$prefix,'receiptFooter'=>$footer,'backupRetentionDays'=>$ret]]);
}

if($path==='/api/v56/admin/logo'&&$method==='POST'){
  $u=admin56();if(empty($_FILES['logo'])||!is_uploaded_file($_FILES['logo']['tmp_name']))r56(422,['ok'=>false,'message'=>'Pilih file logo terlebih dahulu']);$f=$_FILES['logo'];if((int)$f['size']<=0||(int)$f['size']>2*1024*1024)r56(422,['ok'=>false,'message'=>'Ukuran logo maksimal 2 MB']);
  $fi=new finfo(FILEINFO_MIME_TYPE);$mime=(string)$fi->file($f['tmp_name']);$allowed=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'];if(!isset($allowed[$mime]))r56(422,['ok'=>false,'message'=>'Logo harus PNG, JPG, atau WebP']);
  if(!is_dir(V56_BRANDING_DIR)&&!@mkdir(V56_BRANDING_DIR,0750,true))r56(500,['ok'=>false,'message'=>'Folder branding belum siap']);$key='school-'.$schoolId.'.'.$allowed[$mime];$dest=V56_BRANDING_DIR.'/'.$key;
  foreach(glob(V56_BRANDING_DIR.'/school-'.$schoolId.'.*')?:[] as$old)if(is_file($old))@unlink($old);if(!move_uploaded_file($f['tmp_name'],$dest))r56(500,['ok'=>false,'message'=>'Gagal menyimpan logo']);@chmod($dest,0640);
  $url='/api/v1/branding/logo';$q=$pdo->prepare('UPDATE schools SET logo_storage_key=?,logo_mime=?,logo_url=?,logo_updated_at=NOW(),updated_at=NOW() WHERE id=?');$q->execute([$key,$mime,$url,$schoolId]);audit56($pdo,$schoolId,(int)$u['id'],'branding.logo.updated','school',(string)$schoolId,['mime'=>$mime,'size'=>(int)$f['size']]);r56(200,['ok'=>true,'message'=>'Logo sekolah berhasil disimpan','logoUrl'=>$url.'?v='.time()]);
}

if(preg_match('#^/api/v56/receipts/(\d+)$#',$path,$m)&&$method==='GET'){
  $u=user56();$pid=(int)$m[1];$q=$pdo->prepare("SELECT p.id,p.receipt,p.amount,p.method,p.paid_at,p.voided,p.void_reason,s.id student_id,s.nis,s.name student_name,c.name class_name,b.title,u.name verified_by,sc.* FROM payments p JOIN students s ON s.id=p.student_id LEFT JOIN classes c ON c.id=s.class_id JOIN bills b ON b.id=p.bill_id LEFT JOIN users u ON u.id=p.verified_by JOIN schools sc ON sc.id=p.school_id WHERE p.school_id=? AND p.id=?");$q->execute([$schoolId,$pid]);$r=$q->fetch();if(!$r)r56(404,['ok'=>false,'message'=>'Kwitansi tidak ditemukan']);
  $role=(string)($u['role']??'');if($role==='parent'){$a=$pdo->prepare('SELECT 1 FROM guardian_students WHERE guardian_user_id=? AND student_id=?');$a->execute([(int)$u['id'],(int)$r['student_id']]);if(!$a->fetchColumn())r56(403,['ok'=>false,'message'=>'Kwitansi bukan milik siswa Anda']);}elseif(!in_array($role,['admin','finance'],true))r56(403,['ok'=>false,'message'=>'Akses ditolak']);
  header('Content-Type: text/html; charset=utf-8');$logo=logoPath56($r)?'<img class="logo" src="/api/v1/branding/logo" alt="Logo sekolah">':'';$status=(bool)$r['voided']?'VOID':'VALID';$statusClass=(bool)$r['voided']?'void':'valid';$footer=trim((string)($r['receipt_footer']??''));$sign=$r['treasurer_name']?:($r['verified_by']?:'Bendahara');
  echo '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kwitansi '.h56($r['receipt']).'</title><style>body{font-family:Arial,sans-serif;background:#f4f7fb;margin:0;padding:24px;color:#172033}.sheet{max-width:760px;margin:auto;background:#fff;border-radius:16px;padding:36px;box-shadow:0 10px 40px #1d2a4414}.head{display:flex;gap:18px;align-items:center;border-bottom:2px solid #e8edf5;padding-bottom:20px}.logo{width:72px;height:72px;object-fit:contain}.head h1{font-size:20px;margin:0 0 5px}.head p{margin:2px 0;color:#60708a}.title{text-align:center;margin:26px 0}.title h2{margin:0}.row{display:flex;justify-content:space-between;gap:30px;padding:10px 0;border-bottom:1px dashed #dbe3ef}.row span{color:#67758d}.total{font-size:20px;font-weight:700;border-top:2px solid #172033;margin-top:12px}.status{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:700}.valid{background:#e7f8ef;color:#087b45}.void{background:#fdebec;color:#b4232c}.sign{margin-top:38px;text-align:right}.footer{margin-top:30px;color:#66758a;font-size:12px;text-align:center}.actions{text-align:center;margin:20px}.actions button{padding:10px 18px;border:0;border-radius:9px;background:#2563eb;color:white;font-weight:700}@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button></div><main class="sheet"><div class="head">'.$logo.'<div><h1>'.h56($r['app_name']?:$r['name']).'</h1><p>'.h56($r['name']).'</p><p>'.h56(trim(($r['npsn']?'NPSN '.$r['npsn'].' · ':'').($r['address']??''))).'</p></div></div><div class="title"><h2>KWITANSI PEMBAYARAN</h2><p>No. <b>'.h56($r['receipt']).'</b> · <span class="status '.$statusClass.'">'.$status.'</span></p></div><div class="row"><span>Nama Siswa</span><b>'.h56($r['student_name']).'</b></div><div class="row"><span>NIS / Kelas</span><b>'.h56($r['nis'].' / '.($r['class_name']?:'-')).'</b></div><div class="row"><span>Tagihan</span><b>'.h56($r['title']).'</b></div><div class="row"><span>Tanggal Pembayaran</span><b>'.h56(date('d-m-Y H:i',strtotime((string)$r['paid_at']))).'</b></div><div class="row"><span>Metode</span><b>'.h56($r['method']).'</b></div><div class="row"><span>Petugas</span><b>'.h56($r['verified_by']?:'-').'</b></div><div class="row total"><span>Total</span><b>'.h56(rupiah56((float)$r['amount'])).'</b></div>'.((bool)$r['voided']?'<p><b>Alasan VOID:</b> '.h56($r['void_reason']?:'-').'</p>':'').'<div class="sign"><p>'.h56($r['name']).', '.h56(date('d-m-Y')).'</p><br><br><b>'.h56($sign).'</b><p>Bendahara / Petugas Keuangan</p></div>'.($footer!==''?'<div class="footer">'.nl2br(h56($footer)).'</div>':'<div class="footer">Dokumen ini dihasilkan dari ledger pembayaran EduPay dan dapat diverifikasi melalui sistem sekolah.</div>').'</main></body></html>';exit;
}

r56(404,['ok'=>false,'message'=>'Endpoint V5.6 tidak ditemukan']);
