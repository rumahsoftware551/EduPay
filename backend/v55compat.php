<?php
declare(strict_types=1);
$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;}
$config=require $configFile;header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
session_name($config['app']['cookie_name']??'edupay_session');session_set_cookie_params(['lifetime'=>(int)($config['app']['session_ttl']??43200),'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_start();
function r55c(int $s,array $d):never{http_response_code($s);echo json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if(empty($_SESSION['user'])||!in_array($_SESSION['user']['role']??'',['admin','finance'],true))r55c(401,['ok'=>false,'message'=>'Belum login']);
$pdo=new PDO($config['db']['dsn'],$config['db']['user'],$config['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$code=$config['app']['school_code']??'default-school';$q=$pdo->prepare('SELECT id FROM schools WHERE code=?');$q->execute([$code]);$schoolId=(int)$q->fetchColumn();if(!$schoolId)r55c(500,['ok'=>false,'message'=>'Sekolah belum tersedia']);
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';
if($path==='/api/v55compat/state'&&$method==='GET'){$q=$pdo->prepare("SELECT (SELECT COUNT(*) FROM classes WHERE school_id=?) classes,(SELECT COUNT(*) FROM students WHERE school_id=?) students,(SELECT COUNT(*) FROM fee_types WHERE school_id=?) fee_types,(SELECT COUNT(*) FROM bills WHERE school_id=?) bills,(SELECT COUNT(*) FROM payments WHERE school_id=?) payments");$q->execute([$schoolId,$schoolId,$schoolId,$schoolId,$schoolId]);$c=$q->fetch();r55c(200,['ok'=>true,'lightweight'=>true,'counts'=>['classes'=>(int)$c['classes'],'students'=>(int)$c['students'],'feeTypes'=>(int)$c['fee_types'],'bills'=>(int)$c['bills'],'payments'=>(int)$c['payments']]]);}
if($path==='/api/v55compat/sync-all'&&$method==='POST')r55c(200,['ok'=>true,'noChanges'=>true,'serverFirst'=>true,'message'=>'Sinkronisasi snapshot legacy dinonaktifkan pada V5.5']);
r55c(404,['ok'=>false,'message'=>'Compatibility endpoint tidak ditemukan']);
