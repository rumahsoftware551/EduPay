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

function r47(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function in47():array{$d=json_decode(file_get_contents('php://input')?:'{}',true);return is_array($d)?$d:[];}
function db47(array $c):PDO{return new PDO($c['db']['dsn'],$c['db']['user'],$c['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function school47(PDO $pdo,array $c):int{$code=$c['app']['school_code']??'default-school';$st=$pdo->prepare('SELECT id FROM schools WHERE code=?');$st->execute([$code]);$id=$st->fetchColumn();if($id)return (int)$id;$st=$pdo->prepare('INSERT INTO schools(code,name) VALUES(?,?) RETURNING id');$st->execute([$code,$c['app']['school_name']??'Sekolah EduPay']);return (int)$st->fetchColumn();}
function admin47():array{if(empty($_SESSION['user'])||($_SESSION['user']['role']??'')!=='admin')r47(403,['ok'=>false,'message'=>'Akses admin diperlukan']);return $_SESSION['user'];}
function phone47(string $value):string{$s=preg_replace('/[\s()\-]/','',trim($value));if(str_starts_with($s,'+62'))$s='0'.substr($s,3);elseif(str_starts_with($s,'62'))$s='0'.substr($s,2);return $s;}
function audit47(PDO $pdo,int $schoolId,int $userId,string $action,array $meta=[]):void{$st=$pdo->prepare('INSERT INTO audit_logs(school_id,user_id,action,metadata,ip_address,user_agent) VALUES(?,?,?,?::jsonb,?,?)');$st->execute([$schoolId,$userId,$action,json_encode($meta,JSON_UNESCAPED_UNICODE),$_SERVER['REMOTE_ADDR']??null,$_SERVER['HTTP_USER_AGENT']??null]);}

$pdo=db47($config);$schoolId=school47($pdo,$config);$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';$method=$_SERVER['REQUEST_METHOD']??'GET';

if($path==='/api/v47/health'&&$method==='GET')r47(200,['ok'=>true,'version'=>'4.7','student_guardian_sync'=>true]);

if($path==='/api/v47/admin/students/sync'&&$method==='POST'){
  $admin=admin47();$in=in47();
  $classes=is_array($in['classes']??null)?$in['classes']:[];
  $students=is_array($in['students']??null)?$in['students']:[];
  $pdo->beginTransaction();
  try{
    $classMap=[];$classCount=0;$studentCount=0;
    foreach($classes as $c){
      $ext=trim((string)($c['id']??$c['externalId']??''));
      $name=trim((string)($c['name']??''));if($name==='')continue;
      $level=trim((string)($c['level']??''));$year=trim((string)($c['academicYear']??''));$active=($c['active']??true)!==false;
      $cid=null;
      if($ext!==''){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$ext]);$cid=$st->fetchColumn()?:null;}
      if(!$cid){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND name=? AND academic_year IS NOT DISTINCT FROM ? ORDER BY id DESC LIMIT 1');$st->execute([$schoolId,$name,$year?:null]);$cid=$st->fetchColumn()?:null;}
      if(!$cid){$st=$pdo->prepare('INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(?,?,?,?,?,?) RETURNING id');$st->execute([$schoolId,$ext?:null,$name,$level?:null,$year?:null,$active]);$cid=(int)$st->fetchColumn();}
      else{$st=$pdo->prepare('UPDATE classes SET external_id=COALESCE(?,external_id),name=?,level=?,academic_year=?,active=?,updated_at=NOW() WHERE id=?');$st->execute([$ext?:null,$name,$level?:null,$year?:null,$active,$cid]);$cid=(int)$cid;}
      if($ext!=='')$classMap[$ext]=$cid;$classMap['name:'.mb_strtolower($name)]=$cid;$classCount++;
    }

    foreach($students as $s){
      $nis=trim((string)($s['nis']??''));$name=trim((string)($s['name']??''));if($nis===''||$name==='')continue;
      $ext=trim((string)($s['id']??$s['externalId']??''));$parent=trim((string)($s['parent']??$s['guardianName']??''));$phone=phone47((string)($s['phone']??$s['guardianPhone']??''));$active=($s['active']??true)!==false;
      $classId=null;$classExt=trim((string)($s['classId']??''));$className=trim((string)($s['className']??''));
      if($classExt!==''&&isset($classMap[$classExt]))$classId=$classMap[$classExt];
      elseif($className!==''&&isset($classMap['name:'.mb_strtolower($className)]))$classId=$classMap['name:'.mb_strtolower($className)];
      elseif($classExt!==''){$st=$pdo->prepare('SELECT id FROM classes WHERE school_id=? AND external_id=? LIMIT 1');$st->execute([$schoolId,$classExt]);$classId=$st->fetchColumn()?:null;}
      $st=$pdo->prepare("INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(school_id,nis) DO UPDATE SET external_id=EXCLUDED.external_id,name=EXCLUDED.name,class_id=EXCLUDED.class_id,guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,active=EXCLUDED.active,updated_at=NOW()");
      $st->execute([$schoolId,$ext?:null,$nis,$name,$classId,$parent?:null,$phone?:null,$active]);$studentCount++;
    }
    $pdo->commit();
    audit47($pdo,$schoolId,(int)$admin['id'],'student.sync',['classes'=>$classCount,'students'=>$studentCount]);
    r47(200,['ok'=>true,'classes'=>$classCount,'students'=>$studentCount]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if($path==='/api/v47/admin/students/status'&&$method==='GET'){
  admin47();
  $st=$pdo->prepare("SELECT COUNT(*) total,COUNT(*) FILTER(WHERE active=TRUE) active,COUNT(*) FILTER(WHERE active=TRUE AND guardian_phone IS NOT NULL AND guardian_phone<>'') with_guardian_phone FROM students WHERE school_id=?");$st->execute([$schoolId]);$s=$st->fetch()?:[];
  r47(200,['ok'=>true,'total'=>(int)($s['total']??0),'active'=>(int)($s['active']??0),'withGuardianPhone'=>(int)($s['with_guardian_phone']??0)]);
}

r47(404,['ok'=>false,'message'=>'Endpoint V4.7 tidak ditemukan']);
