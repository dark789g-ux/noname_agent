function getErrorTip(msg) {
  if (typeof msg != "string") {
    try {
      msg = msg.toString();
      if (typeof msg != "string") {
        throw new Error("err");
      }
    } catch (_) {
      throw new Error("传参错误:" + msg);
    }
  }
  if (msg.startsWith("Uncaught ")) {
    msg = msg.slice(9);
  }
  let newMessage = msg;
  if (/RangeError/.test(newMessage)) {
    if (newMessage.includes("Maximum call stack size exceeded")) {
      newMessage = "堆栈溢出";
    } else if (/argument must be between 0 and 20/.test(newMessage)) {
      let funName = newMessage.slice(newMessage.indexOf("RangeError: ") + 12, newMessage.indexOf(")") + 1);
      newMessage = funName + "参数必须在0和20之间";
    } else {
      newMessage = "传递错误值到数值计算方法";
    }
  } else if (/ReferenceError/.test(newMessage)) {
    let messageName;
    if (newMessage.includes("is not defined")) {
      messageName = newMessage.replace("ReferenceError: ", "").replace(" is not defined", "");
      newMessage = "引用了一个未定义的变量：" + messageName;
    } else if (newMessage.includes("invalid assignment left-hand side")) {
      newMessage = "赋值运算符或比较运算符不匹配";
    } else if (newMessage.includes("Octal literals are not allowed in strict mode")) {
      newMessage = "八进制字面量与八进制转义序列语法已经被废弃";
    } else if (newMessage.includes("Illegal 'use strict' directive in function with non-simple parameter list")) {
      newMessage = "'use strict'指令不能使用在带有‘非简单参数’列表的函数";
    } else if (newMessage.includes("Invalid left-hand side in assignment")) {
      newMessage = "赋值中的左侧无效，即number，string等不可赋值的非变量数据";
    }
  } else if (/SyntaxError/.test(newMessage)) {
    let messageName;
    if (newMessage.includes("Unexpected token ")) {
      messageName = newMessage.replace("SyntaxError: Unexpected token ", "");
      newMessage = "使用了未定义或错误的语法 : (" + messageName + ")";
    } else if (newMessage.includes("Block-scoped declarations (let, const, function, class) not yet supported outside strict mode")) {
      newMessage = "请在严格模式下运行let，const，class";
    } else if (newMessage.includes("for-of loop variable declaration may not have an initializer.")) {
      newMessage = "for...of 循环的头部包含有初始化表达式";
    } else if (newMessage.includes("for-in loop variable declaration may not have an initializer.")) {
      newMessage = "for...in 循环的头部包含有初始化表达式";
    } else if (newMessage.includes("Delete of an unqualified identifier in strict mode.")) {
      newMessage = "普通变量不能通过 delete 操作符来删除";
    } else if (newMessage.includes("Unexpected identifier")) {
      newMessage = "不合法的标识符或错误的语法";
    } else if (newMessage.includes("Invalid or unexpected token")) {
      newMessage = "非法的或者不期望出现的标记符号出现在不该出现的位置";
    } else if (newMessage.includes("Invalid regular expression flags")) {
      newMessage = "无效的正则表达式的标记";
    } else if (newMessage.includes("missing ) after argument list")) {
      newMessage = "参数列表后面缺少 ')' (丢失运算符或者转义字符等)";
    } else if (newMessage.includes("Invalid shorthand property initializer")) {
      newMessage = "在定义一个{}对象时，应该使用':'而不是'='";
    } else if (newMessage.includes("Missing initializer in const declaration")) {
      newMessage = "在使用const定义一个对象时，必须指定初始值";
    } else if (newMessage.includes("Unexpected number") || newMessage.includes("Unexpected string")) {
      newMessage = "在定义函数时，函数参数必须为合法标记符";
    } else if (newMessage.includes("Unexpected end of input")) {
      newMessage = "遗漏了符号或符号顺序不对(小括号，花括号等)";
    } else if (newMessage.includes("has already been declared")) {
      messageName = newMessage.replace("SyntaxError: Identifier ", "").replace(" has already been declared", "");
      newMessage = messageName + "变量已经被声明过，不能被重新声明";
    } else if (newMessage.includes("Duplicate parameter name not allowed in this context")) {
      newMessage = "参数名不允许重复";
    } else if (newMessage.includes("Unexpected reserved word") || newMessage.includes("Unexpected strict mode reserved word")) {
      newMessage = "保留字被用作标记符";
    }
  } else if (/TypeError/.test(newMessage)) {
    let messageName;
    if (newMessage.includes(" is not a function")) {
      messageName = newMessage.replace("TypeError: ", "").replace(" is not a function", "");
      newMessage = messageName + "不是一个函数";
    } else if (newMessage.includes(" is not a constructor")) {
      messageName = newMessage.replace("TypeError: ", "").replace(" is not a constructor", "");
      newMessage = messageName + "不是一个构造函数";
    } else if (newMessage.includes("Cannot read property")) {
      messageName = newMessage.replace("TypeError: Cannot read property ", "").replace(" of null", "").replace(" of undefined", "");
      let ofName = newMessage.slice(newMessage.indexOf(" of ") + 4);
      newMessage = "无法读取'" + ofName + "'的属性值" + messageName;
    } else if (newMessage.includes("Cannot read properties")) {
      messageName = newMessage.slice(newMessage.indexOf("reading '") + 9, -2);
      let ofName = newMessage.slice(newMessage.indexOf(" of ") + 4, newMessage.indexOf("(") - 1);
      newMessage = "无法读取'" + ofName + "'的属性值" + messageName;
    } else if (newMessage.includes("Property description must be an object")) {
      messageName = newMessage.replace("TypeError: Property description must be an object: ", "");
      newMessage = messageName + "是非对象类型的值";
    } else if (newMessage.includes("Cannot assign to read only property ")) {
      messageName = newMessage.slice(47, newMessage.lastIndexOf(" of ") + 1);
      newMessage = messageName + "属性禁止写入";
    } else if (newMessage.includes("Object prototype may only be an Object or null")) {
      newMessage = messageName + "对象原型只能是对象或null";
    } else if (newMessage.includes("Cannot create property")) {
      messageName = newMessage.slice(newMessage.indexOf("'") + 1);
      messageName = messageName.slice(0, messageName.indexOf("'"));
      let obj = newMessage.slice(newMessage.indexOf(messageName) + 16);
      newMessage = obj + "不能添加或修改'" + messageName + "'属性，任何 Primitive 值都不允许有property";
    } else if (newMessage.includes("Can't add property") && newMessage.includes("is not extensible")) {
      newMessage = "对象不可添加属性（不可扩展）";
    } else if (newMessage.includes("Cannot redefine property")) {
      messageName = newMessage.slice(37);
      newMessage = messageName + "不可配置";
    } else if (newMessage.includes("Converting circular structure to JSON")) {
      messageName = newMessage.slice(37);
      newMessage = "JSON.stringify() 方法处理循环引用结构的JSON会失败";
    } else if (newMessage.includes("Cannot use 'in' operator to search for ")) {
      newMessage = "in不能用来在字符串、数字或者其他基本类型的数据中进行检索";
    } else if (newMessage.includes("Right-hand side of 'instanceof' is not an object")) {
      newMessage = "instanceof 操作符 希望右边的操作数为一个构造对象，即一个有 prototype 属性且可以调用的对象";
    } else if (newMessage.includes("Assignment to constant variable")) {
      newMessage = "const定义的变量不可修改";
    } else if (newMessage.includes("Cannot delete property")) {
      newMessage = "不可配置的属性不能删除";
    } else if (newMessage.includes("which has only a getter")) {
      newMessage = "仅设置了getter特性的属性不可被赋值";
    } else if (newMessage.includes("called on incompatible receiver undefined")) {
      newMessage = "this提供的绑定对象与预期的不匹配";
    }
  } else if (/URIError/.test(newMessage)) {
    newMessage = "一个不合法的URI";
  } else if (/EvalError/.test(newMessage)) {
    newMessage = "非法调用 eval()";
  } else if (/InternalError/.test(newMessage)) {
    if (newMessage.includes("too many switch cases")) {
      newMessage = "过多case子句";
    } else if (newMessage.includes("too many parentheses in regular expression")) {
      newMessage = "正则表达式中括号过多";
    } else if (newMessage.includes("array initializer too large")) {
      newMessage = "超出数组大小的限制";
    } else if (newMessage.includes("too much recursion")) {
      newMessage = "递归过深";
    }
  }
  if (newMessage != msg) {
    return newMessage;
  }
}
export {
  getErrorTip
};
