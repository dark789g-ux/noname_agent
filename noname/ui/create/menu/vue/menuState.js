const menuUpdates = [];
let updateActive;
function setUpdateActive(fun) {
  updateActive = fun;
}
let updateActiveCard;
function setUpdateActiveCard(fun) {
  updateActiveCard = fun;
}
const menuInits = [];
export {
  menuInits,
  menuUpdates,
  setUpdateActive,
  setUpdateActiveCard,
  updateActive,
  updateActiveCard
};
