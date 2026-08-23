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

function r46(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function in46():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db46(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school46(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$st=$pdo->prepare('SELECT id FROM schools WHERE code=?');$st->execute([$code]);$id=$st->fetchColumn();if($id)return (int)$id;$st=$pdo->prepare('INSERT INTO schools(code,name) VALUES(?,?) RETURNING id');$st->execute([$code,$c['app']['school_name']??'Sekolah EduPay']);return (int)$st->fetchColumn();}
function admin46():array{if(empty($_SESSION['user'])||($_SESSION['user']['role']??'')!=='admin')r46(403,['ok'=>false,'message'=>'Akses admin diperlukan']);return $_SESSION['user'];}
function audit46(PDO $pdo,int $schoolId,int $userId,string $action,array $meta=[]):void{$st=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?::jsonb,?,?)');$st->execute([$schoolId,$userId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}

$pdo=db46($config);$schoolId=school46($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v46/health'&&$method==='GET')r46(200,['ok'=>true,'version'=>'4.6','academic_sync'=>true]);

if($path==='/api/v46/homerooms'&&$method==='GET'){
  admin46();
  $st=$pdo->prepare("SELECT h.id,h.external_id,h.nip,h.name,h.phone,h.email,h.active,h.updated_at,
    COALESCE(json_agg(json_build_object('id',c.id,'externalId',c.external_id,'name',c.name,'level',c.level,'academicYear',c.academic_year)) FILTER (WHERE c.id IS NOT NULL),'[]'::json) classes
    FROM homeroom_teachers h LEFT JOIN classes c ON c.homeroom_teacher_id=h.id
    WHERE h.school_id=? GROUP BY h.id ORDER BY h.active DESC,h.name");
  $st->execute([$schoolId]);$rows=$st->fetchAll();
  foreach($rows as &$x){$x['id']=(int)$x['id'];$x['active']=(bool)$x['active'];if(is_string($x['classes']))$x['classes']=json_decode($x['classes'],true)?:[];}unset($x);
  r46(200,['ok'=>true,'homerooms'=>$rows]);
}

if($path==='/api/v46/homerooms/sync'&&$method==='POST'){
  $admin=admin46();$in=in46();$teachers=is_array($in['teachers']??null)?$in['teachers']:[];$classes=is_array($in['classes']??null)?$in['classes']:[];
  $seen=[];
  foreach($classes as $c){if(($c['active']??true)===false)continue;$tid=(string)($c['homeroomTeacherId']??'');if($tid==='')continue;if(isset($seen[$tid]))r46(422,['ok'=>false,'message'=>'Satu wali kelas tidak boleh diampu oleh lebih dari satu kelas aktif']);$seen[$tid]=true;}
  $pdo->beginTransaction();
  try{
    $map=[];$synced=0;
    foreach($teachers as $t){
      $ext=trim((string)($t['id']??$t['externalId']??''));$name=trim((string)($t['name']??''));if($ext===''||$name==='')continue;
      $nip=trim((string)($t['nip']??''));$phone=trim((string)($t['phone']??''));$email=trim((string)($t['email']??''));$active=($t['active']??true)!==false;
      $st=$pdo->prepare("INSERT INTO homeroom_teachers(school_id,external_id,nip,name,phone,email,active) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(school_id,external_id) DO UPDATE SET nip=EXCLUDED.nip,name=EXCLUDED.name,phone=EXCLUDED.phone,email=EXCLUDED.email,active=EXCLUDED.active,updated_at=NOW() RETURNING id");
      try{$st->execute([$schoolId,$ext,$nip?:null,$name,$phone?:null,$email?:null,$active]);}catch(PDOException $e){if($e->getCode()==='23505')r46(409,['ok'=>false,'message'=>'NIP/NIK wali kelas sudah digunakan']);throw $e;}
      $map[$ext]=(int)$st->fetchColumn();$synced++;
    }
    foreach($classes as $c){
      $ext=trim((string)($c['id']??$c['externalId']??''));$name=trim((string)($c['name']??''));if($ext===''||$name==='')continue;
      $year=trim((string)($c['academicYear']??''));$level=trim((string)($c['level']??''));$active=($c['active']??true)!==false;
      $st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$cid=$st->fetchColumn();
      if(!$cid){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND name=? AND academic_year IS NOT DISTINCT FROM ? LIMIT 1');$st->execute([$schoolId,$name,$year?:null]);$cid=$st->fetchColumn();}
      if(!$cid){$st=$pdo->prepare('INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(?,?,?,?,?,?) RETURNING id');$st->execute([$schoolId,$ext,$name,$level?:null,$year?:null,$active]);$cid=$st->fetchColumn();}
      else{$st=$pdo->prepare('UPDATE classes SET external_id=COALESCE(external_id,?),name=?,level=?,academic_year=?,active=?,updated_at=NOW() WHERE id=?');$st->execute([$ext,$name,$level?:null,$year?:null,$active,$cid]);}
      $tid=(string)($c['homeroomTeacherId']??'');$serverTid=$tid!==''?($map[$tid]??null):null;
      $pdo->prepare('UPDATE classes SET homeroom_teacher_id=?,updated_at=NOW() WHERE id=?')->execute([$serverTid,$cid]);
    }
    $pdo->commit();audit46($pdo,$schoolId,(int)$admin['id'],'homeroom.sync',['teachers'=>$synced,'classes'=>count($classes)]);
    r46(200,['ok'=>true,'synced'=>$synced,'active'=>count(array_filter($teachers,fn($t)=>($t['active']??true)!==false))]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

r46(404,['ok'=>false,'message'=>'Endpoint V4.6 tidak ditemukan']);
