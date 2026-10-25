(() => {
const $ = id => document.getElementById(id);
const fields = [
 {name:"Soja",ha:25,color:0xd2bd36,x:-25,z:-18,w:25,d:18},
 {name:"Milho",ha:18,color:0x4a9d48,x:13,z:-18,w:20,d:18},
 {name:"Trigo",ha:20,color:0xb77b40,x:-25,z:8,w:22,d:17},
 {name:"Morango",ha:12,color:0xd66d72,x:0,z:9,w:7,d:16},
 {name:"Pastagem",ha:30,color:0x3989ad,x:13,z:9,w:18,d:17}
];
let selected=0, spraying=true, auto=true, precision=false, battery=100, tank=100, altitude=4, speed=0, done=0, money=125000;
let move={x:0,y:0}, heightMove={x:0,y:0}, keys={}, last=performance.now(), toastTimer;
const sceneCanvas=$('scene');
let renderer, scene, camera, drone, sprayParticles=[], cropRows=[], fieldMeshes=[];
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function setup3D(){
 if(!window.THREE){$('loading').innerHTML='Não foi possível carregar o motor 3D.<small>Conecte-se à internet e recarregue a página.</small>';return}
 scene=new THREE.Scene();scene.background=new THREE.Color(0x91c9ef);scene.fog=new THREE.Fog(0x91c9ef,90,220);
 camera=new THREE.PerspectiveCamera(55,1,.1,400);
 renderer=new THREE.WebGLRenderer({canvas:sceneCanvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;
 scene.add(new THREE.HemisphereLight(0xd7efff,0x52633b,2.1));
 const sun=new THREE.DirectionalLight(0xfff0d5,2.2);sun.position.set(-40,70,30);sun.castShadow=true;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:0x527c39,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;scene.add(ground);
 // Hills and tree line
 for(let i=0;i<65;i++){let x=(Math.random()-.5)*210,z=-65-Math.random()*65;let h=4+Math.random()*13;let hill=new THREE.Mesh(new THREE.ConeGeometry(8+Math.random()*12,h,7),new THREE.MeshStandardMaterial({color:[0x72965c,0x8da66b,0x698b55][i%3]}));hill.position.set(x,h/2-2,z);scene.add(hill)}
 // Fields, boundaries and crop rows
 fields.forEach((f,idx)=>{
  let mesh=new THREE.Mesh(new THREE.PlaneGeometry(f.w,f.d),new THREE.MeshStandardMaterial({color:f.color,roughness:1,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(f.x,.01,f.z);scene.add(mesh);fieldMeshes.push(mesh);
  const borderMat=new THREE.LineBasicMaterial({color:0xf0e7a0});
  let pts=[new THREE.Vector3(f.x-f.w/2,.06,f.z-f.d/2),new THREE.Vector3(f.x+f.w/2,.06,f.z-f.d/2),new THREE.Vector3(f.x+f.w/2,.06,f.z+f.d/2),new THREE.Vector3(f.x-f.w/2,.06,f.z+f.d/2),new THREE.Vector3(f.x-f.w/2,.06,f.z-f.d/2)];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),borderMat));
  const rowMat=new THREE.MeshStandardMaterial({color:idx===3?0x2e7b37:0x386e2b});
  for(let x=f.x-f.w/2+.5;x<f.x+f.w/2;x+=.8){
   let row=new THREE.Mesh(new THREE.BoxGeometry(.13,.14,f.d-.5),rowMat);row.position.set(x,.09,f.z);scene.add(row);cropRows.push(row);
  }
 });
 // farm buildings
 const barn=new THREE.Mesh(new THREE.BoxGeometry(10,3.5,6),new THREE.MeshStandardMaterial({color:0x9d5433}));barn.position.set(0,1.5,-42);scene.add(barn);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(6.8,2.6,4),new THREE.MeshStandardMaterial({color:0x853e2a}));roof.rotation.y=Math.PI/4;roof.position.set(0,4.2,-42);scene.add(roof);
 for(let i=0;i<3;i++){let silo=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,6,16),new THREE.MeshStandardMaterial({color:0xaeb8b8,metalness:.3,roughness:.6}));silo.position.set(7+i*3,3,-42);scene.add(silo)}
 // road
 let road=new THREE.Mesh(new THREE.PlaneGeometry(130,5),new THREE.MeshStandardMaterial({color:0xb8a58a}));road.rotation.x=-Math.PI/2;road.position.set(0,.03,-31);scene.add(road);
 // trees
 for(let i=0;i<42;i++){let x=(Math.random()-.5)*130,z=(Math.random()-.5)*100;if(Math.abs(z+18)<8)continue;let trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,1.8,6),new THREE.MeshStandardMaterial({color:0x65452b}));trunk.position.set(x,.9,z);scene.add(trunk);let crown=new THREE.Mesh(new THREE.SphereGeometry(1.2+Math.random()*1.2,7,6),new THREE.MeshStandardMaterial({color:[0x47763c,0x578446,0x698d4d][i%3]}));crown.position.set(x,2.4+Math.random(),z);scene.add(crown)}
 // drone
 drone=new THREE.Group();scene.add(drone);
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.5,.35,1),new THREE.MeshStandardMaterial({color:0x252d30,metalness:.3,roughness:.4}));drone.add(body);
 const tankMesh=new THREE.Mesh(new THREE.BoxGeometry(.65,.8,.55),new THREE.MeshStandardMaterial({color:0xdce2df,roughness:.3,metalness:.1}));tankMesh.position.set(0,-.55,0);drone.add(tankMesh);
 const armMat=new THREE.MeshStandardMaterial({color:0x171c1f});
 for(let s of [-1,1])for(let f of [-1,1]){let arm=new THREE.Mesh(new THREE.BoxGeometry(1.55,.12,.13),armMat);arm.position.set(s*.65,0,f*.42);arm.rotation.y=s*f*.45;drone.add(arm);let motor=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.15,12),new THREE.MeshStandardMaterial({color:0x202629}));motor.position.set(s*1.28,.05,f*.78);drone.add(motor);let prop=new THREE.Mesh(new THREE.BoxGeometry(.85,.035,.12),new THREE.MeshStandardMaterial({color:0x333a3d,transparent:true,opacity:.7}));prop.position.set(s*1.28,.15,f*.78);prop.name='prop';drone.add(prop)}
 const led1=new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),new THREE.MeshBasicMaterial({color:0x35ff74}));led1.position.set(-.7,0,.5);drone.add(led1);
 // spray cones
 for(let s of [-.62,.62]){let spray=new THREE.Mesh(new THREE.ConeGeometry(.22,1.7,10,1,true),new THREE.MeshBasicMaterial({color:0xdffaff,transparent:true,opacity:.28,side:THREE.DoubleSide}));spray.rotation.x=Math.PI; spray.position.set(s,-1.35,0);spray.name='spray';drone.add(spray)}
 drone.position.set(fields[0].x,altitude,fields[0].z);
 resize();window.addEventListener('resize',resize);
 $('loading').style.display='none';drawMap();animate();
}
function resize(){if(!renderer||!camera)return;const w=sceneCanvas.clientWidth,h=sceneCanvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function drawMap(){const c=$('minimap'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#31522e';ctx.fillRect(0,0,c.width,c.height);fields.forEach((f,i)=>{let x=20+(f.x+38)*3.1,y=15+(f.z+32)*2.7;ctx.fillStyle=['#d2bd36','#4a9d48','#b77b40','#d66d72','#3989ad'][i];ctx.fillRect(x,y,f.w*2.8,f.d*2.5);ctx.strokeStyle='#d9e5b5';ctx.strokeRect(x,y,f.w*2.8,f.d*2.5);ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.fillText(i+1,x+5,y+15)});ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(150,105,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#55ff7a';ctx.fillText('▲',143,99)}
function selectField(i){selected=i;done=0;fields.forEach((f,j)=>{$('field-choice-'+j)?.classList.toggle('selected',i===j)});document.querySelectorAll('.field-choice').forEach((b,j)=>b.classList.toggle('selected',i===j));$('mission-title').textContent='🌿 Pulverizar Talhão '+(i+1)+' ('+fields[i].name+')';$('area-total').textContent=fields[i].ha;$('area-short-total').textContent=fields[i].ha;drone.position.x=fields[i].x;drone.position.z=fields[i].z;updateUI();toast('Talhão '+(i+1)+' selecionado: '+fields[i].name)}
function updateUI(){let pct=Math.min(100,Math.round(done/fields[selected].ha*100));$('battery').textContent=Math.max(0,battery).toFixed(0)+'%';$('battery-bar').style.width=Math.max(0,battery)+'%';$('tank').textContent=Math.max(0,tank).toFixed(0)+'%';$('tank-bar').style.width=Math.max(0,tank)+'%';$('liters').textContent=Math.round(tank)+' / 100 L';$('altitude').textContent=altitude.toFixed(1);$('speed').textContent=Math.round(speed);$('area-done').textContent=done.toFixed(1).replace('.',',');$('area-short').textContent=done.toFixed(1).replace('.',',');$('progress-text').textContent=pct;$('progress-bar').style.width=pct+'%';if(battery<20)$('battery-bar').style.background='#ff654e';else $('battery-bar').style.background='#50e06b'}
function animate(now=performance.now()){requestAnimationFrame(animate);if(!renderer||!drone)return;let dt=Math.min(.05,(now-last)/1000);last=now;
 let forward=(keys.w||keys.ArrowUp?1:0)-(keys.s||keys.ArrowDown?1:0)-move.y;
 let sideways=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0)+move.x;
 let vertical=(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0)+heightMove.y;
 if(Math.abs(forward)+Math.abs(sideways)>.05){speed=Math.min(24,Math.hypot(forward,sideways)*18);drone.position.z-=forward*dt*8;drone.position.x+=sideways*dt*8}else speed*=.92;
 if(keys.q)drone.rotation.y+=dt;if(keys.e)drone.rotation.y-=dt;
 if(keys[' '])spraying=true;
 altitude=Math.max(1,Math.min(15,altitude+vertical*dt*4));drone.position.y=altitude;
 // Keep the aircraft in the property
 drone.position.x=Math.max(-47,Math.min(45,drone.position.x));drone.position.z=Math.max(-37,Math.min(34,drone.position.z));
 const f=fields[selected];let inside=Math.abs(drone.position.x-f.x)<f.w/2&&Math.abs(drone.position.z-f.z)<f.d/2;
 const sprayMeshes=drone.children.filter(o=>o.name==='spray');sprayMeshes.forEach(o=>o.visible=spraying&&tank>0&&battery>0&&inside);
 if(spraying&&tank>0&&battery>0&&inside&&altitude<8){tank-=dt*1.15;battery-=dt*.22;done=Math.min(f.ha,done+dt*(precision?.025:.07)*(auto?1.3:1));if(Math.random()<.4){let p=new THREE.Mesh(new THREE.SphereGeometry(.07,5,5),new THREE.MeshBasicMaterial({color:0xe4fbff,transparent:true,opacity:.45}));p.position.set(drone.position.x+(Math.random()-.5)*1.5,drone.position.y-1.5,drone.position.z+(Math.random()-.5));p.userData.life=.5+Math.random()*.5;scene.add(p);sprayParticles.push(p)}}
 else if(battery>0)battery-=dt*.035;
 sprayParticles=sprayParticles.filter(p=>{p.userData.life-=dt;p.position.y-=dt*1.7;p.material.opacity=Math.max(0,p.userData.life);if(p.userData.life<=0){scene.remove(p);p.geometry.dispose();p.material.dispose();return false}return true});
 drone.children.filter(o=>o.name==='prop').forEach(o=>o.rotation.y+=dt*35);
 const offset=new THREE.Vector3(0,6,11).applyAxisAngle(new THREE.Vector3(0,1,0),drone.rotation.y);camera.position.lerp(new THREE.Vector3(drone.position.x+offset.x,drone.position.y+offset.y,drone.position.z+offset.z),.08);camera.lookAt(drone.position.x,drone.position.y,drone.position.z-2);
 renderer.render(scene,camera);updateUI();
}
function bindStick(id,callback){const el=$(id),knob=el.querySelector('.stick-knob');let active=false;function set(e){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/(r.width*.34),dy=(e.clientY-cy)/(r.height*.34);let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len}knob.style.left=`calc(50% + ${dx*r.width*.34-21}px)`;knob.style.top=`calc(50% + ${dy*r.height*.34-21}px)`;callback(dx,dy)}el.addEventListener('pointerdown',e=>{active=true;el.setPointerCapture(e.pointerId);set(e)});el.addEventListener('pointermove',e=>{if(active)set(e)});const end=()=>{active=false;knob.style.left='';knob.style.top='';callback(0,0)};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}
bindStick('move-stick',(x,y)=>move={x,y});bindStick('height-stick',(x,y)=>heightMove={x,y});
$('up').onclick=()=>{altitude=Math.min(15,altitude+1);toast('Altitude: '+altitude.toFixed(1)+' m')};$('down').onclick=()=>{altitude=Math.max(1,altitude-1);toast('Altitude: '+altitude.toFixed(1)+' m')};
$('spray').onclick=()=>{spraying=!spraying;$('spray').classList.toggle('active',spraying);$('spray').querySelector('b').textContent=spraying?'ON':'OFF';toast(spraying?'Pulverização ligada':'Pulverização desligada')};
$('auto').onclick=()=>{auto=!auto;$('auto').classList.toggle('active',auto);$('auto').querySelector('b').textContent=auto?'ON':'OFF';toast(auto?'Faixas automáticas ligadas':'Faixas automáticas desligadas')};
$('precision').onclick=()=>{precision=!precision;$('precision').classList.toggle('active',precision);$('precision').querySelector('b').textContent=precision?'ON':'OFF';toast(precision?'Modo precisão ativado':'Modo precisão desativado')};
document.querySelectorAll('.field-choice').forEach((b,i)=>b.addEventListener('click',()=>selectField(i)));
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));b.classList.add('active');let p=b.dataset.panel;if(p==='inicio'){ $('modal').classList.add('hidden');return }showPanel(p)});
function showPanel(p){const titles={mapa:'Mapa da propriedade',drones:'Escolha seu drone',campos:'Selecionar talhão',missoes:'Missões disponíveis'};$('modal-title').textContent=titles[p];let html='';if(p==='drones')html=['Drone compacto · tanque 20 L · autonomia simulada 12 min','Drone profissional · tanque 100 L · autonomia simulada 22 min','Drone de precisão · tanque 100 L · modo precisão'].map((s,i)=>`<button class="option" data-drone="${i}">${s}</button>`).join('');else if(p==='campos'||p==='mapa')html=fields.map((f,i)=>`<button class="option" data-pick="${i}">Talhão ${i+1} — ${f.name} · ${f.ha} ha</button>`).join('');else html='<button class="option" id="start-mission">🌿 Pulverizar talhão selecionado</button><button class="option" id="refill">💧 Reabastecer tanque (R$ 250)</button><button class="option" id="charge">🔋 Carregar bateria (R$ 500)</button>'; $('modal-content').innerHTML=html;$('modal').classList.remove('hidden');document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{selectField(+b.dataset.pick);$('modal').classList.add('hidden')});document.querySelectorAll('[data-drone]').forEach(b=>b.onclick=()=>{let i=+b.dataset.drone;tank=i===0?20:100;battery=100;updateUI();$('modal').classList.add('hidden');toast('Drone selecionado! Tanque: '+tank+' L')});if($('refill'))$('refill').onclick=()=>{if(money>=250){money-=250;tank=100;$('money').textContent=money.toLocaleString('pt-BR');updateUI();toast('Tanque reabastecido')}else toast('Saldo insuficiente')};if($('charge'))$('charge').onclick=()=>{if(money>=500){money-=500;battery=100;$('money').textContent=money.toLocaleString('pt-BR');updateUI();toast('Bateria carregada')}else toast('Saldo insuficiente')};if($('start-mission'))$('start-mission').onclick=()=>{$('modal').classList.add('hidden');toast('Missão iniciada! Voe sobre o talhão para aplicar.')}}
$('close-modal').onclick=()=>$('modal').classList.add('hidden');
window.addEventListener('keydown',e=>{keys[e.key]=true;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==='r'){tank=100;toast('Tanque reabastecido (simulação)')}if(e.key===' '){spraying=!spraying;$('spray').classList.toggle('active',spraying);$('spray').querySelector('b').textContent=spraying?'ON':'OFF'}});window.addEventListener('keyup',e=>keys[e.key]=false);
setup3D();
})();
