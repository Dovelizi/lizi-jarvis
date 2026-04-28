import { renderPlayer } from './player.js';

/**
 * Shell 简化：
 *  - 只有一个 player 视图（资料 / 设置已合并到右侧 MenuDrawer 抽屉）
 *  - 不再有 BottomNav
 */
export function renderApp(root) {
  if (!root.querySelector('[data-mount="player"]')) {
    root.innerHTML = `<div data-region="content" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden"></div>`;
  }
  const content = root.querySelector('[data-region="content"]') || root;
  renderPlayer(content);
}
