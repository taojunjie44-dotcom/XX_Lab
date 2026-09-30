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
  { category: "下肢力量", exercises: names([
    ["深蹲", .30], "预蹲", ["前蹲", .28], "坐姿提踵", "站姿提踵", "臀桥", "启动前蹲", "向心深蹲", "深蹲支撑",
    "保加利亚深蹲", "罗马尼亚硬拉", ["传统硬拉", .15], "举重窄拉", "举重宽拉", "垫高硬拉", "超程硬拉", "直腿硬拉",
    "早安", "单腿硬拉", "箱蹲", "泽奇深蹲", "倒蹬", "相扑深蹲", "过顶深蹲", "箭步蹲", "蹬台阶", "腿屈伸",
    "腿弯举", "北欧挺", "侧弓步蹲"
  ]) },
  { category: "上肢推力", exercises: names([
    ["杠铃卧推", .17], ["暂停卧推", .17], ["上斜卧推", .18], ["窄推", .16], "宽推", "哑铃卧推", "哑铃上斜卧推",
    "俯卧撑", "双杠", ["实力推", .20], "坐姿哑铃推肩", ["坐姿杠铃推肩", .20], "倒立撑", "哑铃侧平举", "哑铃前平举",
    "小军飞鸟", "俯身杠铃片飞鸟", "面拉", "绳索侧平举", "绳索下压", "直杆下压", "哑铃臂屈伸", "杠铃臂屈伸", "碎颅者"
  ]) },
  { category: "上肢拉", exercises: names([
    "引体向上", "反手引体向上", "助力引体向上", "对握引体向上", "高位下拉", "宽距高位下拉", "反手高位下拉", "对握高位下拉",
    "器械划船", "卧拉", "杠铃划船", "潘德类划船", "二头弯举", "锤式弯举", "哑铃单臂划船", "T杆划船", "直臂下压",
    "单手引体", "双力臂"
  ]) },
  { category: "举重及其衍生", exercises: names([
    ["全程高翻", 1.30], ["全程蹲翻", 1.15], ["悬垂高翻", 1.30], ["悬垂蹲翻", 1.15], ["全程高抓", 1.70], ["全程蹲抓", 1.45],
    ["悬垂蹲抓", 1.45], ["悬垂高抓", 1.70], "实力抓", "实力翻", "垫铃抓", "垫铃翻", "跳铃抓", "跳铃翻", "健步挺",
    ["借力推", .35], "悬垂展体拉", "宽速拉", "窄速拉", "宽提拉", "下蹲挺", "架上挺", "挺支撑", "抓支撑", "垫铃宽拉",
    "垫铃窄拉", "颈后挺", "抓举早安"
  ]) },
  { category: "Keiser", exercises: names([
    "Squat", "小腿", "后侧", "犀牛蹲", "左右交替", "背肌", "胸肌", "肩部", "下压", "屈髋肌", "内收肌", "外展肌肉"
  ]) },
  { category: "小肌肉", exercises: names([
    "铁板桥", "山羊挺", "GHD卷腹", "悬垂举腿", "侧屈腹", "哥本哈根支撑", "静力飞燕", "鸭子步", "手腕", "肩外旋",
    "跪姿单边哑铃推举", "瑜伽球拉锯", "握力"
  ]) },
  { category: "增强式", exercises: names([
    "摆臂 CMJ", "不摆臂 CMJ", "深蹲跳", "负重深蹲跳", "箱跳", "坐姿箱跳", "连续纵跳", "跨步跳", "立定跳远",
    "连续蛙跳", "单腿跳", "栏架跳", "连续栏架跳", "跳深", "跳深反弹", "落地制动", "侧向跨跳", "滑冰跳",
    "Pogo 跳", "单腿 Pogo 跳", "短冲刺", "雪橇冲刺", "药球前抛", "药球后抛", "药球砸地"
  ]) },
  { category: "哑铃与壶铃", exercises: names([
    "哑铃深蹲", "高脚杯深蹲", "哑铃罗马尼亚硬拉", "哑铃保加利亚分腿蹲", "哑铃箭步蹲", "哑铃抓举", "哑铃高抓",
    "哑铃翻举", "哑铃推举", "哑铃划船", "壶铃高脚杯深蹲", "壶铃抓举", "壶铃翻举", "壶铃推举", "土耳其起立"
  ]) },
  { category: "自重与核心", exercises: names([
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

