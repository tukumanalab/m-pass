/**
 * アンケート設定
 * 選択肢を変更する場合はこのファイルを編集してください。
 */

export const SURVEY_QUESTION = "つくまなラボをどうやって知りましたか？";

export interface SurveyOption {
  label: string;
  url?: string; // 指定した場合、新規タブで開くリンクをラベルの横に表示
}

/**
 * 選択肢リスト
 * - url を指定すると、ラベルの横に新規タブで開くリンクが表示されます。
 * - 末尾の選択肢が "その他" の場合、自由記述欄が表示されます（SURVEY_OTHER_OPTION と一致するもの）。
 */
export const SURVEY_OPTIONS: SurveyOption[] = [
  { label: "X",               url: "https://x.com/TukumanaLab" },
  { label: "Instagram",       url: "https://www.instagram.com/agu_tukumanalab/" },
  { label: "Web",             url: "https://sites.google.com/view/tukumanalab/" },
  { label: "立て看板" },
  { label: "友達から聞いた" },
  { label: "教職員から聞いた" },
  { label: "偶然通りかかった" },
  { label: "その他" },
];

/** 自由記述を促す選択肢のラベル値 */
export const SURVEY_OTHER_OPTION = "その他";
