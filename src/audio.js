// Recorded CC0 effects by Kenney and CC-BY piano by Alexander Holm.
// Music is an original, slow, generative arrangement of the piano sample.
export class AudioGarden {
  constructor(settings){this.settings=settings;this.buffers={};this.ctx=null;this.timer=null;this.note=0;this.started=false;this.loading=null;}
  async unlock(){
    if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.ctx=new Context();this.master=this.ctx.createGain();this.master.gain.value=.45;this.master.connect(this.ctx.destination);this.musicGain=this.ctx.createGain();this.musicGain.gain.value=.18;this.musicGain.connect(this.master);}
    try{if(this.ctx.state==='suspended')await this.ctx.resume();}catch{return;}
    if(!this.loading)this.loading=Promise.allSettled(Object.entries({place:'place.mp3',pick:'pick.mp3',bloom:'bloom.mp3',clear:'clear.mp3',piano:'piano-c4.mp3'}).map(async([key,file])=>{const response=await fetch(`assets/audio/${file}`);if(!response.ok)throw new Error(file);this.buffers[key]=await this.ctx.decodeAudioData(await response.arrayBuffer());}));
    await this.loading;this.sync();
  }
  play(name,rate=1,volume=.7){if(!this.settings().sound||!this.ctx||!this.buffers[name]||document.hidden)return;const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers[name];source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(this.master);source.start();}
  stackTick(index,total){
    if(!this.ctx)return;
    const now=this.ctx.currentTime;if(now-(this.lastTick??-1)<.025)return;this.lastTick=now;
    this.play('place',.94+Math.min(index,12)*.045,.25+Math.min(total,10)*.012);
  }
  flourish(combo){
    this.play('bloom',1+Math.min(combo-1,4)*.11,.46);
    if(!this.settings().sound||!this.ctx||!this.buffers.piano||document.hidden)return;
    const notes=combo>1?[7,12,16]:[7,12],time=this.ctx.currentTime;
    notes.forEach((note,i)=>{
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),start=time+i*.065;
      source.buffer=this.buffers.piano;source.playbackRate.value=2**((note+Math.min(combo-1,3)*2)/12);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.19,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+.8);
      source.connect(gain).connect(this.master);source.start(start);source.stop(start+.85);
    });
  }
  chord(){if(!this.ctx||!this.buffers.piano||document.hidden||!this.settings().music||!this.settings().sound)return;const chords=[[0,4,7,14],[-3,0,4,7],[-5,0,4,9],[-7,-3,0,7]],notes=chords[this.note++%4];const t=this.ctx.currentTime;notes.forEach((note,i)=>{const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers.piano;s.playbackRate.value=2**(note/12);g.gain.setValueAtTime(0,t+i*.32);g.gain.linearRampToValueAtTime(.5,t+i*.32+.04);g.gain.exponentialRampToValueAtTime(.001,t+5.8);s.connect(g).connect(this.musicGain);s.start(t+i*.32);s.stop(t+6);});}
  sync(){if(this.settings().sound&&this.settings().music&&!document.hidden&&this.ctx){if(!this.timer){this.chord();this.timer=setInterval(()=>this.chord(),5800);}}else if(this.timer){clearInterval(this.timer);this.timer=null;}if(this.master)this.master.gain.setTargetAtTime(this.settings().sound?.45:0,this.ctx.currentTime,.12);if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.settings().music?.18:0,this.ctx.currentTime,.12);}
  suspend(){if(this.timer){clearInterval(this.timer);this.timer=null;}if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}
