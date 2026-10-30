import {ArrowRight, Clock, Gift, LockKeyhole, PencilLine, Sparkles, Users} from 'lucide-react';
import {en, he} from './i18n';
import type {Saved} from './api';
import Wheel from './Wheel';import RoomLibrary from './RoomLibrary';

export default function HomePage({hebrew = false, rooms, busy, onCreate, onJoin, onRestore}: {
 hebrew?: boolean; rooms: Saved[]; busy: boolean; onCreate: () => void; onJoin: () => void; onRestore: (room: Saved) => void;
}) {
 const t = hebrew ? he : en;
 return <div className="home-page">
  <section className="home-hero">
   <div className="hero-copy">
    <span className="christmas-edition">{t.tagline}</span>
    <h1><span>{t.heroLineOne}</span><span>{t.heroLineTwo}</span><em>{t.heroLineThree}</em></h1>
    <p className="hero-intro"><span>{t.heroIntro.split('. ')[0]}.</span><span>{t.heroIntro.split('. ').slice(1).join('. ')}</span></p>
    <div className="home-actions">
     <button className="button primary hero-create" onClick={onCreate}><Gift size={23} />{t.create}</button>
     <button className="button secondary hero-join" onClick={onJoin}>{t.join}</button>
    </div>
    <div className="hero-trust"><span><LockKeyhole size={16} />{t.privateByDesign}</span><span><Clock size={16} />{t.anytime}</span></div>
   </div>
   <div className="hero-art">
    <div className="hero-wheel-halo" />
    <Wheel items={[]} spinning={false} result={null} decorative hebrew={hebrew} />
    <img className="christmas-gifts" src="/assets/christmas-gifts.png" width="2172" height="724" alt="" decoding="async" />
    <span className="hero-wheel-caption"><Gift size={19} />{t.surpriseForEveryone}</span>
   </div>
  </section>
  <section className="christmas-steps" aria-label={t.how}>
   {[
    {Icon: PencilLine, title: t.step1, text: t.step1Text},
    {Icon: Users, title: t.step2, text: t.step2Text},
    {Icon: Gift, title: t.step3, text: t.step3Text}
   ].map(({Icon, title, text}) => <div key={title}><Icon size={34} strokeWidth={1.4} /><h2>{title}</h2><p>{text}</p></div>)}
  </section>
  <RoomLibrary rooms={rooms} busy={busy} onRestore={onRestore} hebrew={hebrew}/>
 </div>;
}
