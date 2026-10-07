// Make a portable HTML edition with the same game and all assets embedded.
// No bundler, dependency, server or network request is needed to play this edition.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const output=process.argv[2]||'/tmp/Hexa-Bloom.html';
const data=(path,type)=>`data:${type};base64,${readFileSync(path).toString('base64')}`;
const assets={};
for(const file of readdirSync('assets/icons'))assets[`assets/icons/${file}`]=data(`assets/icons/${file}`,'image/svg+xml');
for(const file of readdirSync('assets/audio'))assets[`assets/audio/${file}`]=data(`assets/audio/${file}`,file.endsWith('.mp3')?'audio/mpeg':'audio/ogg');
let css=readFileSync('src/style.css','utf8').replace("url('../assets/fonts/Nunito.ttf')",`url('${data('assets/fonts/Nunito.ttf','font/ttf')}')`);
let script=['engine','renderer','audio','main'].map(name=>readFileSync(`src/${name}.js`,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).join('\n');
script=script.replace('fetch(`assets/icons/${name}.svg`)','fetch(BUNDLED_ASSETS[`assets/icons/${name}.svg`])').replace('fetch(`assets/audio/${file}`)','fetch(BUNDLED_ASSETS[`assets/audio/${file}`])');
script=script.replace(/^if\('serviceWorker' in navigator\).*$/m,'');
script=script.replace('<a class="credit-link" href="CREDITS.md" target="_blank" rel="noopener">Tous les crédits</a>','<span>Les licences complètes sont intégrées à ce fichier HTML.</span>');
script=`const BUNDLED_ASSETS=${JSON.stringify(assets)};\n${script}`;
const licenses={};for(const file of readdirSync('assets/licenses'))licenses[file]=readFileSync(`assets/licenses/${file}`,'utf8');licenses['Nunito-OFL']=readFileSync('assets/fonts/OFL.txt','utf8');licenses['CREDITS']=readFileSync('CREDITS.md','utf8');licenses['MIT']=readFileSync('LICENSE','utf8');
let html=readFileSync('index.html','utf8');
html=html.replace(/^.*<link rel="(?:manifest|preload|apple-touch-icon)".*\n/gm,'');
html=html.replace('href="./"','href="#"').replaceAll('assets/icon.svg',data('assets/icon.svg','image/svg+xml'));
html=html.replace('<link rel="stylesheet" href="src/style.css">',`<style>${css}</style>`);
html=html.replace('<script type="module" src="src/main.js"></script>',`<script type="application/json" id="asset-licenses">${JSON.stringify(licenses).replaceAll('<','\\u003c')}</script>\n<script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script>`);
writeFileSync(output,html);
console.log(`Portable game written: ${output} (${Buffer.byteLength(html)} bytes)`);
