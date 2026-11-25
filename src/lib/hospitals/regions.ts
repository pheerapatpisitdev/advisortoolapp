/**
 * The seven parts of the country โรงพยาบาลในเครือ is read by (owner, 2026-11-25, mockup
 * https://claude.ai/artifact/2pdzVimrFm1xLhR5uSNfv5). All 77 provinces are here, with or without a
 * place on the insurer's list today, so a province the insurer adds lands in its own part.
 */
export interface Region { name: string; provinces: string[] }

const region = (name: string, provinces: string): Region => ({ name, provinces: provinces.split(" ") });

export const REGIONS: Region[] = [
  region("กรุงเทพฯ และปริมณฑล", "กรุงเทพมหานคร นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร นครปฐม"),
  region("ภาคกลาง", "ชัยนาท พระนครศรีอยุธยา ลพบุรี สระบุรี สิงห์บุรี อ่างทอง นครนายก สมุทรสงคราม สุพรรณบุรี นครสวรรค์ อุทัยธานี กำแพงเพชร พิจิตร พิษณุโลก สุโขทัย เพชรบูรณ์"),
  region("ภาคเหนือ", "เชียงใหม่ เชียงราย ลำพูน ลำปาง แพร่ น่าน พะเยา แม่ฮ่องสอน อุตรดิตถ์"),
  region("ภาคอีสาน", "นครราชสีมา ขอนแก่น อุดรธานี อุบลราชธานี กาฬสินธุ์ ชัยภูมิ นครพนม บึงกาฬ บุรีรัมย์ มหาสารคาม มุกดาหาร ยโสธร ร้อยเอ็ด เลย ศรีสะเกษ สกลนคร สุรินทร์ หนองคาย หนองบัวลำภู อำนาจเจริญ"),
  region("ภาคตะวันออก", "ชลบุรี ระยอง จันทบุรี ตราด ฉะเชิงเทรา ปราจีนบุรี สระแก้ว"),
  region("ภาคตะวันตก", "กาญจนบุรี ตาก ราชบุรี เพชรบุรี ประจวบคีรีขันธ์"),
  region("ภาคใต้", "กระบี่ ชุมพร ตรัง นครศรีธรรมราช นราธิวาส ปัตตานี พังงา พัทลุง ภูเก็ต ยะลา ระนอง สงขลา สตูล สุราษฎร์ธานี"),
];
