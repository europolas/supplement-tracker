/** Manual mail setup check. No mail is sent unless --send is explicit. DNS and
 * TLS must pass first; never claim delivery from an empty outbox/SMTP handshake.
 * --send sends one setup message to the private initial admin, never logs its address.
 */
import {resolveTxt} from 'node:dns/promises';
import {readFileSync} from 'node:fs';
import {createPublicKey} from 'node:crypto';
import nodemailer from 'nodemailer';
const expected=createPublicKey(readFileSync('/run/secrets/dkim_private')).export({type:'spki',format:'der'}).toString('base64');
const txt=async name=>{try{return (await resolveTxt(name)).map(chunks=>chunks.join(''));}catch{return [];}};
const spf=(await txt('perimove.com')).filter(s=>s.startsWith('v=spf1'));
const dkim=await txt('supplement._domainkey.perimove.com');
const dmarc=await txt('_dmarc.perimove.com');
const dnsReady=spf.length===1&&/(?:^| )a(?: |$)/.test(spf[0])&&dkim.some(s=>s.replace(/\s/g,'').includes('p='+expected))&&dmarc.some(s=>s.startsWith('v=DMARC1;'));
const transport=nodemailer.createTransport({host:'smtp-mail',port:25,requireTLS:true,tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,ca:readFileSync('/run/secrets/smtp_ca')},dkim:{domainName:'perimove.com',keySelector:'supplement',privateKey:readFileSync('/run/secrets/dkim_private')},connectionTimeout:10000,socketTimeout:15000});
try{
 await transport.verify();console.log(JSON.stringify({smtpTlsReady:true,dnsReady,spfReady:spf.length===1,dkimReady:dkim.some(s=>s.replace(/\s/g,'').includes('p='+expected)),dmarcReady:dmarc.length>0}));
 if(process.argv.includes('--send')){
  if(!dnsReady)throw Error('Publish and verify DNS records before sending');
  const admin=JSON.parse(readFileSync('/run/secrets/initial_admin','utf8'));
  const sent=await transport.sendMail({from:'Supplement Tracker <supplements@perimove.com>',to:admin.email,subject:'Supplement Tracker: email setup check',text:'The Supplement Tracker email service is ready for a delivery check. Please confirm that this setup message reached your inbox. No password or recovery link is included.',disableFileAccess:true,disableUrlAccess:true});
  if(!sent.accepted.length)throw Error('Recipient was not accepted');console.log('Setup message accepted by the local relay. Check remote delivery/inbox before enabling recovery.');
 }
}catch(error){console.error('Mail check failed:',error.code||error.message);process.exitCode=1;}
