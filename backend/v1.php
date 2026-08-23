<?php
declare(strict_types=1);

$configFile=__DIR__.'/config.php';
if(!file_exists($configFile)){
    http_response_code(500);header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok'=>false,'message'=>'Backend belum dikonfigurasi']);exit;
}
$config=require $configFile;

$requestIdHeader=(string)($_SERVER['HTTP_X_REQUEST_ID']??'');
$requestId=preg_match('/^[A-Za-z0-9._-]{8,64}$/',$requestIdHeader)?$requestIdHeader:bin2hex(random_bytes(12));
header('X-Request-ID: '.$requestId);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

$logFile='/var/log/edupay/app.log';
function logV1(string $level,string $message,array $context=[]):void{
    global $requestId,$logFile;
    $safe=['request_id'=>$requestId,'method'=>$_SERVER['REQUEST_METHOD']??'','uri'=>parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH),'ip'=>$_SERVER['REMOTE_ADDR']??null]+$context;
    @error_log(date(DATE_ATOM).' '.$level.' '.$message.' '.json_encode($safe,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL,3,$logFile);
}
set_exception_handler(function(Throwable $e):void{
    logV1('ERROR','uncaught_exception',['class'=>get_class($e),'message'=>$e->getMessage(),'file'=>basename($e->getFile()),'line'=>$e->getLine()]);
    if(!headers_sent()){http_response_code(500);header('Content-Type: application/json; charset=utf-8');}
    echo json_encode(['ok'=>false,'message'=>'Terjadi kesalahan pada server.','requestId'=>$GLOBALS['requestId']],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;
});
set_error_handler(function(int $severity,string $message,string $file,int $line):bool{
    if(!(error_reporting()&$severity))return false;
    logV1('WARN','php_error',['severity'=>$severity,'message'=>$message,'file'=>basename($file),'line'=>$line]);
    return false;
});

ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
session_name($config['app']['cookie_name']??'edupay_session');
session_set_cookie_params([
    'lifetime'=>(int)($config['app']['session_ttl']??43200),
    'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax'
]);
session_start();
if(empty($_SESSION['csrf_v1']))$_SESSION['csrf_v1']=bin2hex(random_bytes(32));
$_SESSION['csrf_v53']=(string)$_SESSION['csrf_v1'];

$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';
$query=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_QUERY)?:'';
$method=$_SERVER['REQUEST_METHOD']??'GET';

function jsonV1(int $status,array $payload):never{
    http_response_code($status);header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;
}
function csrfGuardV1():void{
    $got=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');$expected=(string)($_SESSION['csrf_v1']??'');
    if($got===''||$expected===''||!hash_equals($expected,$got)){
        logV1('SECURITY','csrf_rejected');
        jsonV1(419,['ok'=>false,'message'=>'Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.','requestId'=>$GLOBALS['requestId']]);
    }
}

if($path==='/api/v1/health'&&$method==='GET'){
    try{$pdo=new PDO($config['db']['dsn'],$config['db']['user'],$config['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$pdo->query('SELECT 1');}
    catch(Throwable $e){logV1('ERROR','health_db_failed',['message'=>$e->getMessage()]);jsonV1(503,['ok'=>false,'version'=>'5.4','database'=>false,'requestId'=>$requestId]);}
    jsonV1(200,['ok'=>true,'version'=>'5.4','api'=>'v1','security_hardening'=>true,'csrf'=>true,'server_session'=>true,'database'=>true,'requestId'=>$requestId]);
}
if($path==='/api/v1/csrf'&&$method==='GET')jsonV1(200,['ok'=>true,'token'=>(string)$_SESSION['csrf_v1'],'requestId'=>$requestId]);
if(!in_array($method,['GET','HEAD','OPTIONS'],true))csrfGuardV1();

$script=null;$target=null;

if(preg_match('#^/api/v1/auth/(login|logout|me|activate)$#',$path,$m)){$script='api.php';$target='/api/auth/'.$m[1];}
elseif($path==='/api/v1/admin/bootstrap'){$script='api.php';$target='/api/admin/bootstrap';}
elseif(preg_match('#^/api/v1/admin/guardians/(\d+)/(invite|reset|status)$#',$path,$m)){$script='api.php';$target='/api/admin/guardians/'.$m[1].'/'.$m[2];}
elseif($path==='/api/v1/admin/guardians'&&$method==='GET'){$script='v501.php';$target='/api/v501/admin/guardians';}
elseif($path==='/api/v1/admin/guardians/sync'){$script='v501.php';$target='/api/v501/admin/guardians/sync';}
elseif(preg_match('#^/api/v1/admin/guardians/(\d+)/profile$#',$path,$m)){$script='v501.php';$target='/api/v501/admin/guardians/'.$m[1].'/profile';}
elseif($path==='/api/v1/parent/state'){$script='v501.php';$target='/api/v501/parent/state';}
elseif($path==='/api/v1/parent/notifications/read'){$script='v501.php';$target='/api/v501/parent/notifications/read';}
elseif(preg_match('#^/api/v1/admin/(state|school|students(?:/.*)?|classes(?:/.*)?|homerooms(?:/.*)?|fees(?:/.*)?|bills(?:/.*)?)$#',$path,$m)){$script='v53.php';$target='/api/v53/admin/'.$m[1];}
elseif($path==='/api/v1/staff/state'){$script='v49.php';$target='/api/v49/state';}
elseif($path==='/api/v1/staff/sync-all'){$script='v49.php';$target='/api/v49/sync-all';}
elseif(preg_match('#^/api/v1/finance/(bills/\d+/(?:pay|approve|reject)|payments/\d+/void)$#',$path,$m)){$script='v50.php';$target='/api/v50/finance/'.$m[1];}
elseif($path==='/api/v1/parent/payments'){$script='v50.php';$target='/api/v50/parent/payments';}
elseif($path==='/api/v1/verification'){$script='v502.php';$target='/api/v502/verification';}
elseif(preg_match('#^/api/v1/verification/bills/(\d+)/(approve|reject)$#',$path,$m)){$script='v502.php';$target='/api/v502/bills/'.$m[1].'/'.$m[2];}
elseif(preg_match('#^/api/v1/parent/bills/(\d+)/proof$#',$path,$m)){$script='v51.php';$target='/api/v51/parent/bills/'.$m[1].'/proof';}
elseif(preg_match('#^/api/v1/proofs/(\d+)$#',$path,$m)){$script='v51.php';$target='/api/v51/proofs/'.$m[1];}
elseif($path==='/api/v1/staff/notifications'){$script='v52.php';$target='/api/v52/notifications';}
elseif($path==='/api/v1/staff/notifications/read'){$script='v52.php';$target='/api/v52/notifications/read';}

if(!$script||!$target){logV1('INFO','route_not_found');jsonV1(404,['ok'=>false,'message'=>'Endpoint API v1 tidak ditemukan','requestId'=>$requestId]);}
$full=__DIR__.'/'.$script;
if(!is_file($full)){logV1('ERROR','handler_missing',['handler'=>$script]);jsonV1(500,['ok'=>false,'message'=>'Handler API belum tersedia','requestId'=>$requestId]);}

session_write_close();
$_SERVER['REQUEST_URI']=$target.($query!==''?'?'.$query:'');
logV1('INFO','dispatch',['handler'=>$script,'target'=>$target]);
require $full;
