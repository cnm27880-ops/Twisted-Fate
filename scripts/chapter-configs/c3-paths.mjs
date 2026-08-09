// c3（道途）章節切割設定，對應英文原文 "CHAPTER 3: PATHS"
// 9 個小節 = Firebase modules c3 底下的 9 筆（m012~m020，依 order 排序），已與英文原文逐一核對過標題對應關係。
export default {
  chapterId: "c3",
  anchorAfter: "Philosophy", // 每個小節標題行後面幾行內一定會出現這行字，用來跟目錄(TOC)裡的同名項目做區分
  entries: [
    { moduleId: "m012", zhTitle: "散修", enHeading: "Rogue Cultivation" },
    { moduleId: "m013", zhTitle: "邪修", enHeading: "Occult Cultivation" },
    { moduleId: "m014", zhTitle: "體修", enHeading: "Body Refinement Cultivation" },
    { moduleId: "m015", zhTitle: "毒修", enHeading: "Poison Cultivation" },
    { moduleId: "m016", zhTitle: "劍修", enHeading: "Sword Cultivation" },
    { moduleId: "m017", zhTitle: "佛修", enHeading: "Buddhist Cultivation" },
    { moduleId: "m018", zhTitle: "巫修", enHeading: "Shaman (Wu) Cultivation" },
    { moduleId: "m019", zhTitle: "術修", enHeading: "Sorcery Cultivation" },
    { moduleId: "m020", zhTitle: "音修", enHeading: "Tunist Cultivation" },
  ],
  // 最後一個小節（Tunist Cultivation）的結尾，用「下一章 CHAPTER 4 的第一個小節標題」來界定
  nextChapterAnchor: { enHeading: "Array Master" },
};
