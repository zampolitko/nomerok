// Telegram Mini App: на весь экран, без закрытия свайпом вниз, цвета шапки, вибрация на события.
// Вне Telegram (в браузере на компе) ничего не делает.
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  const at = v => tg.isVersionAtLeast && tg.isVersionAtLeast(v);
  document.documentElement.classList.add('tg');
  tg.ready();
  tg.expand();
  if (at('7.7')) tg.disableVerticalSwipes(); // свайп по гаражу не должен сворачивать игру
  if (at('6.1')) { tg.setHeaderColor('#0b0820'); tg.setBackgroundColor('#050510'); }
  if (at('7.10')) tg.setBottomBarColor('#050510');

  // системная кнопка «Назад» Telegram: закрывает телефон или верхнюю открытую панель
  if (at('6.1') && tg.BackButton) {
    const openPanels = () => [...document.querySelectorAll('.overlay:not(.hidden)')];
    const sync = () => {
      const any = !document.getElementById('phone').classList.contains('hidden') || openPanels().length;
      if (any) tg.BackButton.show(); else tg.BackButton.hide();
    };
    tg.BackButton.onClick(() => {
      if (!document.getElementById('phone').classList.contains('hidden')) Phone.hide();
      else { const p = openPanels().pop(); const b = p && p.querySelector('.closeBtn'); if (b) b.click(); }
      sync();
    });
    new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // вибро: чем реже номер, тем сильнее
  const H = at('6.1') && tg.HapticFeedback;
  if (!H || typeof Snd === 'undefined') return;
  const wrap = (name, fx) => {
    const orig = Snd[name];
    if (!orig) return;
    Snd[name] = function (...a) { try { fx(...a); } catch (e) {} return orig.apply(this, a); };
  };
  wrap('jingle', r => {
    if (r === 'uncommon') H.impactOccurred('light');
    else if (r === 'rare') H.impactOccurred('medium');
    else if (r === 'epic') H.impactOccurred('heavy');
    else if (r === 'legendary' || r === 'mythic' || r === 'secret') H.notificationOccurred('success');
  });
  wrap('deny', () => H.notificationOccurred('error'));
  wrap('buy', () => H.impactOccurred('light'));
  wrap('click', () => H.selectionChanged());
})();
