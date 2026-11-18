/** 卡牌的tag的类型，注：作为方法的第二参数很少用上（一般用于二级类型判断） */
type CardTagType = number | ((arg0: Card, arg1: string) => boolean | number) | ((card: Card) =>  boolean | number);
