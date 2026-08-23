<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();

function rr56(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function jf56(string $file):?array{if(!is_file($file))return null;$d=json_decode((string)@file_get_contents($file),true);return is_array($d)?$d:null;}
function lp56(array $s):?string{$key=basename((string)($s['logo_storage_key']??''));if($key==='')return null;$p='/var/lib/edupay/branding/'.$key;return is_file($p)?$p:null;}

if(empty($_SESSION['user'])||($_SESSION['user']['role']??'')!=='admin')rr56(403,['ok'=>false,'message'=>'Akses khusus Administrator']);
$pdo=new PDO($config['db']['dsn'],$config['db']['user'],$config['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$q=$pdo->prepare('SELECT id,name,academic_year_current,support_email,receipt_prefix,logo_url,logo_storage_key FROM schools WHERE code=?');
$q->execute([$config['app']['school_code']??'default-school']);$s=$q->fetch();if(!$s)rr56(500,['ok'=>false,'message'=>'Sekolah aktif tidak ditemukan']);
$backup=jf56('/var/lib/edupay/maintenance/backup-status.json');
$restore=jf56('/var/lib/edupay/maintenance/restore-status.json');
$lastTs=isset($backup['finished_at'])?strtotime((string)$backup['finished_at']):false;
$recent=($backup['ok']??false)===true&&$lastTs!==false&&(time()-$lastTs)<172800;
$checks=[
 ['key'=>'school_name','label'=>'Nama sekolah','pass'=>trim((string)$s['name'])!=='','required'=>true],
 ['key'=>'academic_year','label'=>'Tahun ajaran aktif','pass'=>trim((string)$s['academic_year_current'])!=='','required'=>true],
 ['key'=>'support_email','label'=>'Email support','pass'=>filter_var($s['support_email']??'',FILTER_VALIDATE_EMAIL)!==false,'required'=>true],
 ['key'=>'receipt_prefix','label'=>'Prefix kwitansi','pass'=>preg_match('/^[A-Z0-9-]{2,16}$/',(string)$s['receipt_prefix'])===1,'required'=>true],
 ['key'=>'backup_recent','label'=>'Backup sukses < 48 jam','pass'=>$recent,'required'=>true],
 ['key'=>'restore_verified','label'=>'Restore rehearsal pernah PASS','pass'=>($restore['ok']??false)===true,'required'=>true],
 ['key'=>'logo','label'=>'Logo sekolah','pass'=>lp56($s)!==null||trim((string)($s['logo_url']??''))!=='','required'=>false],
];
$required=array_values(array_filter($checks,fn($c)=>$c['required']));
$passed=count(array_filter($required,fn($c)=>$c['pass']));
$score=$required?(int)round($passed/count($required)*100):100;
rr56(200,['ok'=>true,'score'=>$score,'ready'=>$score===100,'checks'=>$checks,'backup'=>$backup,'restoreVerification'=>$restore]);
