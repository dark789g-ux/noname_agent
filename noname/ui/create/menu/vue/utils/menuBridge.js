const menuBridge = {
  setActiveTab: null,
  /**
   * 切换到指定 tab 的指定左栏项。
   * 用于 extensionTab（切换到"扩展"tab + 指定扩展项）、consoleMenu（切换到"其它"tab + 命令项）。
   */
  setActiveLeftItem: null,
  /**
   * 关闭当前菜单。
   * 由 index.ts menu() 注册（clickContainer 闭包），
   * 供 OtherPane 作弊执行后关闭菜单（对应旧版 cheatButton listen 的 clickContainer）。
   */
  closeMenu: null,
  /**
   * 刷新武将包菜单（收藏变更后调用）。
   * 由 characterPackMenuData 模块级注册（无组件生命周期依赖）：
   * 重建左栏数据（收藏项显隐）并递增 favouriteVersion 驱动右栏重渲染。
   * 供 ui.click.favouriteCharacter 调用（替代旧版 ui.favouriteCharacter DOM 桥接）。
   */
  refreshCharacterPackMenu: null,
  /**
   * 刷新选项页指定配置项（背景音乐增删后调用）。
   * 由 optionsMenuData 模块级注册（无组件生命周期依赖）：
   * 从源数据（lib.configMenu.audio.config.background_music.item）重新拷贝合并进
   * 缓存的 reactive cfg.item 并调 cfg.update?.()。
   * 供 game.addBackgroundMusic / game.removeBackgroundMusic / 音乐导入回调调用
   * （替代旧版 ui.background_music_setting DOM 桥接）。
   * aozhan_bgm 不在选项页渲染（在国战模式 startMenu），对其调用为 no-op。
   */
  refreshOptionsConfig: null,
  /**
   * 切换「导入游戏设置」文件控件的可见状态。
   * 由 OptionsRightPane 挂载时注册、卸载时清理；库配置的 clear 按钮经此
   * 请求操作当前面板，替代已不存在的 ui.import_data_button DOM 节点。
   */
  requestImportData: null,
  /**
   * 菜单容器关闭时清理选项页的瞬态状态。OptionsRightPane 挂载时注册；
   * 容器只是隐藏而非卸载，因此不能依赖组件卸载钩子完成这一步。
   */
  clearOptionsMenuState: null,
  /**
   * 打开「制作扩展」页并（可选）加载指定扩展。
   * 由 ExtensionMaker onMounted 注册、onUnmounted 置 null
   * （ExtensionPane 以 v-if 挂载，未显示时为 null）。
   * 供 index.ts menu() 内的 game.editExtension 稳定桥调用。
   */
  openExtensionMaker: null,
  /**
   * game.editExtension 的待消费扩展名。
   * openExtensionMaker 为 null（ExtensionMaker 未挂载的窗口期）时
   * 由 game.editExtension 写入，ExtensionMaker onMounted 消费后置回 null。
   */
  pendingEditExtensionName: null
};
export {
  menuBridge
};
