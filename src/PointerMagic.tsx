import {useEffect, useRef} from 'react';

// The effect lives outside React's render loop. It never captures input or
// prevents scrolling, and its short-lived elements have a hard upper bound.
export function attachPointerMagic(layer: HTMLElement, target: Window = window) {
 const reduced = target.matchMedia('(prefers-reduced-motion: reduce)');
 const fine = target.matchMedia('(any-hover: hover) and (any-pointer: fine)');
 const active = new Map<HTMLElement, Animation>();
 const presses = new Map<number, {x: number; y: number; time: number}>();
 let lastTrail = 0, lastX = -100, lastY = -100;

 function particle(x: number, y: number, index: number, burst: boolean) {
  if (reduced.matches) return;
  const node = layer.ownerDocument.createElement('span');
  if (typeof node.animate !== 'function') return;
  if (active.size >= 72) {
   const oldest = active.entries().next().value;
   if (oldest) { oldest[1].cancel(); oldest[0].remove(); active.delete(oldest[0]); }
  }
  node.className = `pointer-spark ${burst ? 'tap-spark' : 'trail-spark'}`;
  node.textContent = index % 3 ? '✦' : '❄';
  node.style.left = `${x}px`; node.style.top = `${y}px`;
  node.style.fontSize = `${burst ? 12 + Math.random() * 10 : 5 + Math.random() * 3}px`;
  node.style.color = index % 3 === 1 ? 'var(--pointer-rose)' : 'var(--pointer-gold)';
  layer.append(node);
  const angle = index / 12 * Math.PI * 2;
  const distance = burst ? 32 + Math.random() * 39 : 8;
  const dx = burst ? Math.cos(angle) * distance : (Math.random() - .5) * 20;
  const dy = burst ? Math.sin(angle) * distance + 20 : 23;
  const animation = node.animate([
   {transform: 'translate(-50%,-50%) scale(.25) rotate(0deg)', opacity: 0},
   {transform: `translate(calc(-50% + ${dx * .3}px),calc(-50% + ${dy * .3}px)) scale(1) rotate(35deg)`, opacity: burst ? .95 : .45, offset: .2},
   {transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.25) rotate(${index % 2 ? 140 : -100}deg)`, opacity: 0}
  ], {duration: burst ? 750 + Math.random() * 300 : 380, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'both'});
  active.set(node, animation);
  const remove = () => { node.remove(); active.delete(node); };
  animation.onfinish = remove; animation.oncancel = remove;
 }
 function down(event: PointerEvent) {
  if (reduced.matches || event.pointerType === 'mouse' || event.button !== 0 || !event.isPrimary) return;
  presses.set(event.pointerId, {x: event.clientX, y: event.clientY, time: target.performance.now()});
 }
 function move(event: PointerEvent) {
  const start = presses.get(event.pointerId);
  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) presses.delete(event.pointerId);
  if (reduced.matches || event.pointerType !== 'mouse' || !fine.matches) return;
  const now = target.performance.now();
  if (now - lastTrail < 90 || Math.hypot(event.clientX - lastX, event.clientY - lastY) < 18) return;
  lastTrail = now; lastX = event.clientX; lastY = event.clientY;
  particle(event.clientX, event.clientY, Math.floor(now / 55) % 3, false);
 }
 function up(event: PointerEvent) {
  const start = presses.get(event.pointerId); presses.delete(event.pointerId);
  if (!start || reduced.matches || target.performance.now() - start.time > 650 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
  for (let index = 0; index < 12; index++) particle(event.clientX, event.clientY, index, true);
 }
 function cancel(event: PointerEvent) { presses.delete(event.pointerId); }
 function clear() {
  presses.clear();
  for (const [node, animation] of active) { animation.cancel(); node.remove(); }
  active.clear();
 }
 const options = {passive: true, capture: true};
 target.addEventListener('pointerdown', down, options);
 target.addEventListener('pointermove', move, options);
 target.addEventListener('pointerup', up, options);
 target.addEventListener('pointercancel', cancel, options);
 target.addEventListener('blur', clear);
 reduced.addEventListener('change', clear);
 return () => {
  target.removeEventListener('pointerdown', down, options);
  target.removeEventListener('pointermove', move, options);
  target.removeEventListener('pointerup', up, options);
  target.removeEventListener('pointercancel', cancel, options);
  target.removeEventListener('blur', clear);
  reduced.removeEventListener('change', clear); clear();
 };
}

export default function PointerMagic({enabled}: {enabled: boolean}) {
 const layer = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!enabled || !layer.current) return;
  return attachPointerMagic(layer.current);
 }, [enabled]);
 return <div ref={layer} className="pointer-magic" aria-hidden="true" />;
}
