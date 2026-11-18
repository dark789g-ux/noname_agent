import { withVirtualSelection } from "./legacy-bridge.js";
import { fail, resolveSelectionSpec } from "./selection-adapter.js";
const DEFAULT_MOVE_FILTER_SYMBOL = /* @__PURE__ */ Symbol.for("noname.defaultMoveFilter");
function isCustomFilterMove(filterMove) {
  return typeof filterMove === "function" && !filterMove[DEFAULT_MOVE_FILTER_SYMBOL];
}
class MoveDecisionSession {
  constructor(event, runtime) {
    this.event = event;
    this.runtime = runtime;
    if (event?.selectionSpec === false) fail("move event disabled by selectionSpec: false");
    const spec = resolveSelectionSpec(event.selectionSpec, event, event.player);
    this.spec = spec;
    const reviewedMode = spec?.move;
    if (reviewedMode && !["guanxing", "xunxun", "gongxin", "swap"].includes(reviewedMode)) {
      fail("move event has no reviewed partition contract");
    }
    if (!reviewedMode && isCustomFilterMove(event.filterMove)) {
      fail("move event has UI-dependent filterMove");
    }
    this.mode = reviewedMode || "generic";
    this.piles = flattenMoveList(event.list);
    this.cards = this.piles.flatMap((pile) => pile.cards);
    if (new Set(this.cards).size !== this.cards.length) fail("move candidates contain duplicate cards");
    if ((this.mode === "guanxing" || this.mode === "xunxun") && this.piles.length !== 2) fail("unexpected partition count");
    if (this.mode === "gongxin" && this.piles.length !== 3) fail("unexpected partition count");
    if (!this.piles.length) fail("unexpected partition count");
    const cleanPrompt = event.prompt ? String(event.prompt).replace(/<[^>]+>/g, "").trim() : "";
    const initialSummary = this.piles.map((pile, index) => `堆${index}(${pile.title})=[${pile.cards.map((card) => `m${this.cards.indexOf(card)}`).join(",")}]`).join("，");
    const pileLimits = this.piles.map((pile, index) => `堆${index}(${pile.title})保持 ${pile.cards.length} 张`).join("、");
    const instruction = this.mode === "gongxin" ? "从手牌中选择恰好一张红桃放入弃置或置顶堆，其余留在原堆；允许取消。" : this.mode === "xunxun" ? "顶堆和底堆各两张，堆内从左向右排列，左侧先摸到。" : this.mode === "guanxing" ? "第一堆置于牌堆顶，第二堆置于牌堆底；堆内从左向右排列，左侧先摸到。" : this.mode === "swap" ? `在各牌堆间进行等量交换或堆内排序（允许保持原样）。${cleanPrompt ? `提示：${cleanPrompt}。` : ""}固定容量：${pileLimits}。初始分布：${initialSummary}` : `按规则在各牌堆间分配并排序全部卡牌（必须守恒）。${cleanPrompt ? `提示：${cleanPrompt}。` : ""}初始分布：${initialSummary}`;
    this.stage = {
      id: "move",
      type: "move",
      range: [this.cards.length, this.cards.length],
      items: this.cards.map((card, index) => ({ ref: `m${index}`, label: runtime.cardLabel?.(card) || runtime.translate(card) })),
      piles: this.piles.map((pile, index) => ({ index, title: pile.title })),
      instruction
    };
  }
  piles;
  cards;
  mode;
  spec;
  stage;
  revalidate() {
    const current = flattenMoveList(this.event.list).flatMap((pile) => pile.cards);
    if (current.length !== this.cards.length || current.some((card, index) => card !== this.cards[index])) fail("move candidates changed during decision");
    if (this.mode === "gongxin") {
      const target = this.event.getParent?.()?.target;
      if (target && this.cards.some((card) => !target.getCards("h").includes(card))) fail("gongxin hand changed during decision");
    }
  }
  checkpoint() {
    return null;
  }
  rollback(_checkpoint) {
  }
  accept(tool) {
    if (tool.name === "pass" && !this.event.forced) return { result: { bool: false } };
    if (tool.name !== "move_cards") fail("expected move_cards");
    this.revalidate();
    const refs = tool.arguments.piles;
    if (!Array.isArray(refs) || refs.length !== this.piles.length || refs.some((pile) => !Array.isArray(pile))) fail("invalid move piles");
    const flat = refs.flat();
    const allowed = this.stage.items.map((item) => item.ref);
    if (flat.length !== allowed.length || new Set(flat).size !== flat.length || flat.some((ref) => !allowed.includes(ref))) fail("move must conserve every card exactly once");
    const moved = refs.map((pile) => pile.map((ref) => this.cards[allowed.indexOf(ref)]));
    if (this.mode === "swap" && moved.some((pile, index) => pile.length !== this.piles[index].cards.length)) {
      fail("swap requires each pile to preserve its initial card count");
    }
    if (this.mode === "xunxun" && moved.some((pile) => pile.length !== 2)) fail("xunxun requires two cards in each pile");
    if (this.mode === "gongxin") {
      const selected = [...moved[1], ...moved[2]];
      if (selected.length !== 1 || this.runtime.getSuit(selected[0]) !== "heart") fail("gongxin requires exactly one heart");
      const unchanged = this.cards.filter((card) => card !== selected[0]);
      if (moved[0].some((card, index) => card !== unchanged[index])) fail("gongxin must preserve the remaining hand order");
    }
    if (typeof this.spec?.finalPredicate === "function") {
      const ok = withVirtualSelection(
        this.runtime.legacyBridgeHost,
        { event: this.event, player: this.event.player, cards: [], targets: [] },
        () => !!this.spec.finalPredicate({ event: this.event, player: this.event.player, moved }, this.event, this.event.player)
      );
      if (!ok) fail("move final predicate rejected proposal");
    }
    if (typeof this.event.filterOk === "function") {
      const ok = withVirtualSelection(
        this.runtime.legacyBridgeHost,
        { event: this.event, player: this.event.player, cards: [], targets: [] },
        () => !!this.event.filterOk(moved)
      );
      if (!ok) fail("move final predicate rejected proposal");
    }
    return { result: { bool: true, moved } };
  }
  toLogResult(result) {
    return { bool: result.bool, piles: result.moved?.map((pile) => pile.map((card) => `m${this.cards.indexOf(card)}`)) };
  }
}
function flattenMoveList(list) {
  if (!Array.isArray(list)) fail("move list is unavailable");
  return list.flatMap((row) => {
    const groups = Array.isArray(row?.[0]) ? row : [row];
    return groups.map((group) => {
      const cards = group?.[1] ?? [];
      if (!Array.isArray(cards) || cards.some((card) => !card || typeof card !== "object" || Array.isArray(card))) fail("unreviewed move items");
      return { title: String(group[0]), cards: cards.slice() };
    });
  });
}
export {
  MoveDecisionSession,
  flattenMoveList
};
