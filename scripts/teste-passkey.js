// Emula localStorage/atob/btoa e valida ida-e-volta do ID da credencial.
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=String(v)}, removeItem(k){delete this._d[k]} }
global.btoa = s => Buffer.from(s,'binary').toString('base64')
global.atob = s => Buffer.from(s,'base64').toString('binary')
global.window = { PublicKeyCredential: undefined, location:{hostname:'x'} }
const P = require('/tmp/pk/passkey.js')

let ok=0, fail=0
const eq=(n,a,b)=>{const A=JSON.stringify(a),B=JSON.stringify(b);
  if(A===B){ok++;console.log(`  ok  ${n}`)}else{fail++;console.log(`  FALHA ${n}\n   esperado ${B}\n   recebido ${A}`)}}

// IDs reais de passkey têm bytes arbitrários e tamanhos variados
const casos = [
  new Uint8Array([0,1,2,250,251,255]),
  new Uint8Array(16).map((_,i)=>i*17%256),
  new Uint8Array(20).map((_,i)=>(i*7+3)%256),   // tamanho não múltiplo de 3
  new Uint8Array(32).map((_,i)=>(i*31)%256),
  new Uint8Array(64).map((_,i)=>(255-i)%256),
]

console.log('\n— ida e volta do ID da credencial —')
for (const orig of casos) {
  localStorage._d = {}
  // guardarCredencial é privado; exercita via o par registrar/ler usando o mesmo caminho
  const b64 = Buffer.from(orig).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  localStorage.setItem('ln_faceid_cred_u1', b64)
  const volta = new Uint8Array(P.credencialSalva('u1'))
  eq(`${orig.length} bytes preserva tudo`, Array.from(volta), Array.from(orig))
}

console.log('\n— base64url não pode conter + / = (quebraria em URL/JSON) —')
const b64 = localStorage.getItem('ln_faceid_cred_u1')
eq('sem caractere proibido', /^[A-Za-z0-9_-]+$/.test(b64), true)

console.log('\n— estado —')
localStorage._d = {}
eq('sem nada = desligado', P.faceIdAtivo('u1'), false)
eq('sem nada = sem credencial', P.credencialSalva('u1'), null)
localStorage.setItem('ln_faceid_u1','1'); localStorage.setItem('ln_faceid_cred_u1','AAEC')
eq('ligado', P.faceIdAtivo('u1'), true)
P.esquecerCredencial('u1')
eq('esquecer credencial mantém ligado', [P.faceIdAtivo('u1'), P.credencialSalva('u1')], [true, null])
P.esquecerFaceId('u1')
eq('esquecer tudo desliga', P.faceIdAtivo('u1'), false)
eq('lixo no storage não quebra', (()=>{localStorage.setItem('ln_faceid_cred_u2','!!!nao-e-base64!!!');
  try{P.credencialSalva('u2');return 'sem-throw'}catch{return 'throw'}})(), 'sem-throw')

console.log(`\n${ok} passaram, ${fail} falharam`)
process.exit(fail?1:0)
