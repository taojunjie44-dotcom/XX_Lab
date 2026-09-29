export interface ExerciseDefinition {
  name: string;
  defaultMvt?: number;
}

export interface ExerciseGroup {
  category: string;
  exercises: ExerciseDefinition[];
}

const names = (items: (string | [string, number])[]): ExerciseDefinition[] =>
  items.map((item) => Array.isArray(item) ? { name: item[0], defaultMvt: item[1] } : { name: item });

export const exerciseGroups: ExerciseGroup[] = [
  { category: "深蹲与下肢力量", exercises: names([
    ["深蹲", .30], ["高杠深蹲", .30], ["低杠深蹲", .30], ["前蹲", .28], "箱式深蹲", "暂停深蹲", "节奏深蹲",
    "泽奇深蹲", "哈克深蹲", "安全杠深蹲", "过顶深蹲", "相扑深蹲", "保加利亚分腿蹲", "分腿蹲", "箭步蹲",
    "反向箭步蹲", "侧向箭步蹲", "台阶上步", "腿举", "哈克机深蹲", "腿屈伸", "腿弯举", "北欧腿弯举"
  ]) },
  { category: "髋主导与拉力", exercises: names([
    ["硬拉", .15], ["传统硬拉", .15], ["相扑硬拉", .15], ["陷阱杠硬拉", .18], "罗马尼亚硬拉", "直腿硬拉", "暂停硬拉",
    "垫高硬拉", "架上硬拉", "宽握硬拉", "早安式", "杠铃臀推", "臀桥", "单腿罗马尼亚硬拉", "壶铃摆动",
    "反向挺身", "山羊挺身", "绳索拉胯"
  ]) },
  { category: "水平推与胸部", exercises: names([
    ["卧推", .17], ["暂停卧推", .17], ["窄握卧推", .16], ["上斜卧推", .18], "下斜卧推", "地板卧推", "Spoto 卧推",
    "弹弓卧推", "双板卧推", "哑铃卧推", "上斜哑铃卧推", "哑铃地板卧推", "俯卧撑", "负重俯卧撑", "双杠臂屈伸",
    "器械推胸", "绳索夹胸", "哑铃飞鸟"
  ]) },
  { category: "肩上推举与肩部", exercises: names([
    ["站姿推举", .20], ["坐姿推举", .20], ["借力推举", .35], "颈后推举", "Z Press", "单臂哑铃推举", "阿诺德推举",
    "地雷管推举", "倒立撑", "哑铃侧平举", "哑铃前平举", "俯身飞鸟", "面拉", "绳索侧平举", "器械肩推"
  ]) },
  { category: "上肢拉与背部", exercises: names([
    "引体向上", "负重引体向上", "反手引体向上", "高位下拉", "杠铃划船", "潘德雷划船", "哑铃单臂划船", "胸托划船",
    "坐姿绳索划船", "T 杠划船", "倒立划船", "直臂下压", "耸肩", "农夫行走", "单臂农夫行走"
  ]) },
  { category: "举重竞赛与经典动作", exercises: names([
    ["抓举", 1.45], ["高抓", 1.70], ["低抓", 1.55], ["挺举", 1.05], ["高翻", 1.30], ["低翻", 1.15], "实力抓举", "实力翻",
    "悬垂抓举", "悬垂高抓", "悬垂翻", "悬垂高翻", "箱上抓举", "箱上高抓", "箱上翻", "箱上高翻",
    "分腿挺举", "下蹲挺", "借力挺", "实力挺", "高位悬垂抓举", "膝下悬垂抓举", "高位悬垂翻", "膝下悬垂翻"
  ]) },
  { category: "举重拉与辅助动作", exercises: names([
    ["抓举拉", .75], ["高抓拉", 1.05], ["翻举拉", .65], ["高翻拉", .90], "抓举硬拉", "翻举硬拉", "抓举宽握硬拉",
    "暂停抓举拉", "暂停翻举拉", "垫高抓举拉", "垫高翻举拉", "箱上抓举拉", "箱上翻举拉", "窄距抓举",
    "肌肉抓举", "肌肉翻", "抓举平衡", "颈后下蹲挺", "前架支撑", "过顶支撑", "抓举握宽早安式"
  ]) },
  { category: "增强式与弹跳", exercises: names([
    "摆臂 CMJ", "不摆臂 CMJ", "深蹲跳", "负重深蹲跳", "箱跳", "坐姿箱跳", "连续纵跳", "跨步跳", "立定跳远",
    "连续蛙跳", "单腿跳", "栏架跳", "连续栏架跳", "跳深", "跳深反弹", "落地制动", "侧向跨跳", "滑冰跳",
    "Pogo 跳", "单腿 Pogo 跳", "短冲刺", "雪橇冲刺", "药球前抛", "药球后抛", "药球砸地"
  ]) },
  { category: "哑铃、壶铃与单侧训练", exercises: names([
    "哑铃深蹲", "高脚杯深蹲", "哑铃罗马尼亚硬拉", "哑铃保加利亚分腿蹲", "哑铃箭步蹲", "哑铃抓举", "哑铃高抓",
    "哑铃翻举", "哑铃推举", "哑铃划船", "壶铃高脚杯深蹲", "壶铃抓举", "壶铃翻举", "壶铃推举", "土耳其起立"
  ]) },
  { category: "自重、核心与辅助", exercises: names([
    "徒手深蹲", "单腿蹲", "手枪蹲", "俯卧撑", "钻石俯卧撑", "双杠臂屈伸", "引体向上", "悬垂举腿", "卷腹",
    "死虫", "鸟狗", "平板支撑", "侧桥", "Pallof Press", "腹轮", "农夫行走", "雪橇推", "雪橇拉",
    "二头弯举", "锤式弯举", "绳索下压", "仰卧臂屈伸", "提踵", "胫骨前肌抬脚", "髋外展", "髋内收"
  ]) }
];

export const exercises = [...new Set(exerciseGroups.flatMap((group) => group.exercises.map((exercise) => exercise.name)))];

export const vbtExercises = exerciseGroups
  .flatMap((group) => group.exercises)
  .filter((exercise) => exercise.defaultMvt !== undefined);

export function defaultMvtFor(exercise: string): number | undefined {
  return vbtExercises.find((item) => item.name === exercise)?.defaultMvt;
}

