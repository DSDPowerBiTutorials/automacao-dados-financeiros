const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento dos produtos com financial_account_code e is_active
const productUpdates = [
    { code: "PROD-889", financial_account_code: "103.0", is_active: true },
    { code: "PROD-890", financial_account_code: "104.0", is_active: true },
    { code: "PROD-892", financial_account_code: "105.1", is_active: true },
    { code: "PROD-886", financial_account_code: "101.1", is_active: true },
    { code: "PROD-160", financial_account_code: "101.1", is_active: true },
    { code: "PROD-476", financial_account_code: "101.1", is_active: true },
    { code: "PROD-868", financial_account_code: "102.5", is_active: true },
    { code: "PROD-151", financial_account_code: "103.0", is_active: true },
    { code: "PROD-475", financial_account_code: "101.1", is_active: true },
    { code: "PROD-876", financial_account_code: "101.1", is_active: true },
    { code: "PROD-335", financial_account_code: "101.1", is_active: true },
    { code: "PROD-870", financial_account_code: "101.1", is_active: true },
    { code: "PROD-873", financial_account_code: "101.1", is_active: true },
    { code: "PROD-477", financial_account_code: "101.1", is_active: true },
    { code: "PROD-852", financial_account_code: "101.1", is_active: true },
    { code: "PROD-333", financial_account_code: "103.0", is_active: true },
    { code: "PROD-468", financial_account_code: "104.0", is_active: true },
    { code: "PROD-334", financial_account_code: "103.0", is_active: true },
    { code: "PROD-850", financial_account_code: "104.0", is_active: true },
    { code: "PROD-191", financial_account_code: null, is_active: false }, // TEST
    { code: "PROD-857", financial_account_code: "101.1", is_active: true },
    { code: "PROD-332", financial_account_code: "104.0", is_active: true },
    { code: "PROD-305", financial_account_code: "104.0", is_active: true },
    { code: "PROD-486", financial_account_code: "104.0", is_active: true },
    { code: "PROD-336", financial_account_code: "104.0", is_active: true },
    { code: "PROD-158", financial_account_code: "104.0", is_active: true },
    { code: "PROD-152", financial_account_code: "104.0", is_active: true },
    { code: "PROD-915", financial_account_code: "101.1", is_active: true },
    { code: "PROD-916", financial_account_code: "101.1", is_active: true },
    { code: "PROD-480", financial_account_code: "102.1", is_active: true },
    { code: "PROD-479", financial_account_code: "102.1", is_active: true },
    { code: "PROD-484", financial_account_code: "102.1", is_active: true },
    { code: "PROD-905", financial_account_code: "102.1", is_active: true },
    { code: "PROD-499", financial_account_code: "102.1", is_active: true },
    { code: "PROD-500", financial_account_code: "102.1", is_active: true },
    { code: "PROD-337", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-496", financial_account_code: "102.1", is_active: true },
    { code: "PROD-489", financial_account_code: "102.1", is_active: true },
    { code: "PROD-493", financial_account_code: "102.1", is_active: true },
    { code: "PROD-492", financial_account_code: "102.1", is_active: true },
    { code: "PROD-750", financial_account_code: "102.1", is_active: true },
    { code: "PROD-749", financial_account_code: "102.1", is_active: true },
    { code: "PROD-758", financial_account_code: "102.1", is_active: true },
    { code: "PROD-759", financial_account_code: "101.1", is_active: true },
    { code: "PROD-760", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-321", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-964", financial_account_code: "101.1", is_active: true },
    { code: "PROD-965", financial_account_code: "101.1", is_active: true },
    { code: "PROD-967", financial_account_code: null, is_active: true }, // #N/D
    // DSD Clinics Contract Management Fee 2025 - todos sem financial_account
    { code: "PROD-969", financial_account_code: null, is_active: true },
    { code: "PROD-970", financial_account_code: null, is_active: true },
    { code: "PROD-971", financial_account_code: null, is_active: true },
    { code: "PROD-972", financial_account_code: null, is_active: true },
    { code: "PROD-973", financial_account_code: null, is_active: true },
    { code: "PROD-974", financial_account_code: null, is_active: true },
    { code: "PROD-975", financial_account_code: null, is_active: true },
    { code: "PROD-976", financial_account_code: null, is_active: true },
    { code: "PROD-977", financial_account_code: null, is_active: true },
    { code: "PROD-978", financial_account_code: null, is_active: true },
    { code: "PROD-979", financial_account_code: null, is_active: true },
    { code: "PROD-980", financial_account_code: null, is_active: true },
    { code: "PROD-981", financial_account_code: null, is_active: true },
    { code: "PROD-982", financial_account_code: null, is_active: true },
    { code: "PROD-983", financial_account_code: null, is_active: true },
    { code: "PROD-984", financial_account_code: null, is_active: true },
    { code: "PROD-985", financial_account_code: null, is_active: true },
    { code: "PROD-986", financial_account_code: null, is_active: true },
    { code: "PROD-987", financial_account_code: null, is_active: true },
    { code: "PROD-988", financial_account_code: null, is_active: true },
    { code: "PROD-989", financial_account_code: null, is_active: true },
    { code: "PROD-990", financial_account_code: null, is_active: true },
    { code: "PROD-991", financial_account_code: null, is_active: true },
    { code: "PROD-992", financial_account_code: null, is_active: true },
    { code: "PROD-993", financial_account_code: null, is_active: true },
    { code: "PROD-994", financial_account_code: null, is_active: true },
    { code: "PROD-995", financial_account_code: null, is_active: true },
    { code: "PROD-996", financial_account_code: null, is_active: true },
    { code: "PROD-997", financial_account_code: null, is_active: true },
    { code: "PROD-998", financial_account_code: null, is_active: true },
    { code: "PROD-999", financial_account_code: null, is_active: true },
    { code: "PROD-1000", financial_account_code: null, is_active: true },
    { code: "PROD-1001", financial_account_code: null, is_active: true },
    { code: "PROD-1002", financial_account_code: null, is_active: true },
    { code: "PROD-1003", financial_account_code: null, is_active: true },
    { code: "PROD-1004", financial_account_code: null, is_active: true },
    { code: "PROD-1005", financial_account_code: null, is_active: true },
    { code: "PROD-1006", financial_account_code: null, is_active: true },
    { code: "PROD-1007", financial_account_code: null, is_active: true },
    { code: "PROD-1008", financial_account_code: null, is_active: true },
    { code: "PROD-1009", financial_account_code: null, is_active: true },
    { code: "PROD-1010", financial_account_code: null, is_active: true },
    { code: "PROD-1011", financial_account_code: null, is_active: true },
    { code: "PROD-1012", financial_account_code: null, is_active: true },
    { code: "PROD-1013", financial_account_code: null, is_active: true },
    { code: "PROD-1014", financial_account_code: null, is_active: true },
    { code: "PROD-1015", financial_account_code: null, is_active: true },
    { code: "PROD-1016", financial_account_code: null, is_active: true },
    { code: "PROD-1017", financial_account_code: null, is_active: true },
    { code: "PROD-1018", financial_account_code: null, is_active: true },
    { code: "PROD-1019", financial_account_code: null, is_active: true },
    { code: "PROD-1020", financial_account_code: null, is_active: true },
    { code: "PROD-1021", financial_account_code: null, is_active: true },
    { code: "PROD-1022", financial_account_code: null, is_active: true },
    { code: "PROD-1023", financial_account_code: null, is_active: true },
    { code: "PROD-1024", financial_account_code: null, is_active: true },
    { code: "PROD-1025", financial_account_code: null, is_active: true },
    { code: "PROD-1026", financial_account_code: null, is_active: true },
    { code: "PROD-1027", financial_account_code: null, is_active: true },
    { code: "PROD-1028", financial_account_code: null, is_active: true },
    { code: "PROD-1029", financial_account_code: null, is_active: true },
    { code: "PROD-1030", financial_account_code: null, is_active: true },
    { code: "PROD-1031", financial_account_code: null, is_active: true },
    { code: "PROD-1032", financial_account_code: null, is_active: true },
    { code: "PROD-1033", financial_account_code: null, is_active: true },
    { code: "PROD-1034", financial_account_code: null, is_active: true },
    { code: "PROD-1035", financial_account_code: null, is_active: true },
    { code: "PROD-1036", financial_account_code: null, is_active: true },
    { code: "PROD-178", financial_account_code: "102.1", is_active: true },
    { code: "PROD-774", financial_account_code: "102.1", is_active: true },
    { code: "PROD-156", financial_account_code: "101.4", is_active: true },
    { code: "PROD-765", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-742", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-772", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-313", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-314", financial_account_code: "103.0", is_active: true },
    { code: "PROD-179", financial_account_code: "104.0", is_active: true },
    { code: "PROD-453", financial_account_code: "102.7", is_active: true },
    { code: "PROD-183", financial_account_code: "104.0", is_active: true },
    { code: "PROD-180", financial_account_code: "104.0", is_active: true },
    { code: "PROD-316", financial_account_code: "103.0", is_active: true },
    { code: "PROD-182", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-322", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-187", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-157", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-188", financial_account_code: "103.0", is_active: true },
    { code: "PROD-155", financial_account_code: "104.0", is_active: true },
    { code: "PROD-839", financial_account_code: "103.0", is_active: true },
    { code: "PROD-309", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-714", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-462", financial_account_code: null, is_active: true }, // #N/D
    { code: "PROD-828", financial_account_code: "104.0", is_active: true },
    { code: "PROD-815", financial_account_code: "103.0", is_active: true },
    { code: "PROD-816", financial_account_code: "104.0", is_active: true },
    { code: "PROD-186", financial_account_code: "104.0", is_active: true },
    { code: "PROD-154", financial_account_code: "104.0", is_active: true },
    { code: "PROD-175", financial_account_code: "103.0", is_active: true },
    { code: "PROD-807", financial_account_code: "103.0", is_active: true },
    { code: "PROD-311", financial_account_code: "103.0", is_active: true },
    { code: "PROD-312", financial_account_code: "105.1", is_active: true },
    { code: "PROD-456", financial_account_code: "105.1", is_active: true },
    { code: "PROD-153", financial_account_code: "105.1", is_active: true },
    { code: "PROD-184", financial_account_code: "105.1", is_active: true },
    { code: "PROD-810", financial_account_code: "105.1", is_active: true },
    { code: "PROD-177", financial_account_code: "105.1", is_active: true },
    { code: "PROD-809", financial_account_code: "101.4", is_active: true },
    { code: "PROD-176", financial_account_code: "101.4", is_active: true },
    { code: "PROD-725", financial_account_code: "101.4", is_active: true },
    { code: "PROD-633", financial_account_code: "103.0", is_active: true },
    { code: "PROD-198", financial_account_code: "101.3", is_active: true },
    { code: "PROD-638", financial_account_code: "103.0", is_active: true },
    { code: "PROD-640", financial_account_code: "103.0", is_active: true },
    { code: "PROD-394", financial_account_code: "104.0", is_active: true },
    { code: "PROD-1241", financial_account_code: "104.0", is_active: true },
    { code: "PROD-637", financial_account_code: "104.0", is_active: true },
    { code: "PROD-346", financial_account_code: "104.0", is_active: true },
    { code: "PROD-200", financial_account_code: "104.0", is_active: true },
    { code: "PROD-630", financial_account_code: "105.1", is_active: true },
    { code: "PROD-392", financial_account_code: "103.0", is_active: true },
    { code: "PROD-199", financial_account_code: "103.0", is_active: true },
    { code: "PROD-610", financial_account_code: "103.0", is_active: true },
    { code: "PROD-390", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1298", financial_account_code: "103.0", is_active: true },
    { code: "PROD-613", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1295", financial_account_code: "103.0", is_active: true },
    { code: "PROD-195", financial_account_code: "103.0", is_active: true },
    { code: "PROD-172", financial_account_code: "104.0", is_active: true },
    { code: "PROD-196", financial_account_code: "103.0", is_active: true },
    { code: "PROD-352", financial_account_code: "104.0", is_active: true },
    { code: "PROD-1283", financial_account_code: "101.1", is_active: true },
    { code: "PROD-605", financial_account_code: "101.1", is_active: true },
    { code: "PROD-617", financial_account_code: "101.1", is_active: true },
    { code: "PROD-353", financial_account_code: "101.1", is_active: true },
    { code: "PROD-604", financial_account_code: "101.1", is_active: true },
    { code: "PROD-385", financial_account_code: "101.1", is_active: true },
    { code: "PROD-170", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1330", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1331", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1335", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1336", financial_account_code: "103.0", is_active: true },
    { code: "PROD-197", financial_account_code: "103.0", is_active: true },
    { code: "PROD-359", financial_account_code: "103.0", is_active: true },
    { code: "PROD-169", financial_account_code: "103.0", is_active: true },
    { code: "PROD-340", financial_account_code: "104.0", is_active: true },
    { code: "PROD-301", financial_account_code: "103.0", is_active: true },
    { code: "PROD-341", financial_account_code: "102.5", is_active: true },
    { code: "PROD-194", financial_account_code: "104.0", is_active: true },
    { code: "PROD-173", financial_account_code: "103.0", is_active: true },
    { code: "PROD-342", financial_account_code: "103.0", is_active: true },
    { code: "DSD UPPER", financial_account_code: "103.0", is_active: true },
    { code: "PROD-302", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1050", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1049", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1047", financial_account_code: "104.0", is_active: true },
    { code: "PROD-338", financial_account_code: "104.0", is_active: true },
    { code: "PROD-303", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1040", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1041", financial_account_code: "104.0", is_active: true },
    { code: "PROD-1042", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1043", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1039", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1037", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1038", financial_account_code: "101.1", is_active: true },
    { code: "PROD-396", financial_account_code: "101.1", is_active: true },
    { code: "PROD-646", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1201", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1202", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1203", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1204", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1205", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1206", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1207", financial_account_code: "101.5", is_active: true },
    { code: "PROD-1208", financial_account_code: "101.5", is_active: true },
    { code: "PROD-1209", financial_account_code: "103.0", is_active: true },
    { code: "PROD-174", financial_account_code: "104.0", is_active: true },
    { code: "PROD-193", financial_account_code: "104.0", is_active: true },
    { code: "PROD-643", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1231", financial_account_code: "101.1", is_active: true },
    { code: "PROD-645", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1227", financial_account_code: "103.0", is_active: true },
    { code: "PROD-345", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1225", financial_account_code: "103.0", is_active: true },
    { code: "PROD-161", financial_account_code: "103.0", is_active: true },
    // PC Product Discounts - todos inativos
    { code: "PROD-1101", financial_account_code: null, is_active: false },
    { code: "PROD-1102", financial_account_code: null, is_active: false },
    { code: "PROD-1103", financial_account_code: null, is_active: false },
    { code: "PROD-1104", financial_account_code: null, is_active: false },
    { code: "PROD-1105", financial_account_code: null, is_active: false },
    { code: "PROD-1106", financial_account_code: null, is_active: false },
    { code: "PROD-1107", financial_account_code: null, is_active: false },
    { code: "PROD-1108", financial_account_code: null, is_active: false },
    { code: "PROD-1109", financial_account_code: null, is_active: false },
    { code: "PROD-1110", financial_account_code: null, is_active: false },
    { code: "PROD-1111", financial_account_code: null, is_active: false },
    { code: "PROD-1112", financial_account_code: null, is_active: false },
    { code: "PROD-1113", financial_account_code: null, is_active: false },
    { code: "PROD-1114", financial_account_code: null, is_active: false },
    { code: "PROD-1115", financial_account_code: null, is_active: false },
    { code: "PROD-1116", financial_account_code: null, is_active: false },
    { code: "PROD-1117", financial_account_code: null, is_active: false },
    { code: "PROD-1118", financial_account_code: null, is_active: false },
    { code: "PROD-1119", financial_account_code: null, is_active: false },
    { code: "PROD-1120", financial_account_code: null, is_active: false },
    { code: "PROD-1121", financial_account_code: null, is_active: false },
    { code: "PROD-1122", financial_account_code: null, is_active: false },
    { code: "PROD-1123", financial_account_code: null, is_active: false },
    { code: "PROD-1124", financial_account_code: null, is_active: false },
    { code: "PROD-1125", financial_account_code: null, is_active: false },
    { code: "PROD-1126", financial_account_code: null, is_active: false },
    { code: "PROD-1127", financial_account_code: null, is_active: false },
    { code: "PROD-1128", financial_account_code: null, is_active: false },
    { code: "PROD-1129", financial_account_code: null, is_active: false },
    { code: "PROD-1130", financial_account_code: null, is_active: false },
    { code: "PROD-1131", financial_account_code: null, is_active: false },
    { code: "PROD-1132", financial_account_code: null, is_active: false },
    { code: "PROD-1133", financial_account_code: null, is_active: false },
    { code: "PROD-1134", financial_account_code: null, is_active: false },
    { code: "PROD-1135", financial_account_code: null, is_active: false },
    { code: "PROD-1136", financial_account_code: null, is_active: false },
    { code: "PROD-1137", financial_account_code: null, is_active: false },
    { code: "PROD-1138", financial_account_code: null, is_active: false },
    { code: "PROD-1139", financial_account_code: null, is_active: false },
    { code: "PROD-1140", financial_account_code: null, is_active: false },
    { code: "PROD-1141", financial_account_code: null, is_active: false },
    { code: "PROD-1142", financial_account_code: null, is_active: false },
    { code: "PROD-1143", financial_account_code: null, is_active: false },
    { code: "PROD-1144", financial_account_code: null, is_active: false },
    { code: "PROD-1145", financial_account_code: null, is_active: false },
    { code: "PROD-1146", financial_account_code: null, is_active: false },
    { code: "PROD-1147", financial_account_code: null, is_active: false },
    { code: "PROD-1148", financial_account_code: null, is_active: false },
    { code: "PROD-1149", financial_account_code: null, is_active: false },
    { code: "PROD-1150", financial_account_code: null, is_active: false },
    { code: "PROD-1151", financial_account_code: null, is_active: false },
    { code: "PROD-1152", financial_account_code: null, is_active: false },
    { code: "PROD-1153", financial_account_code: null, is_active: false },
    { code: "PROD-1154", financial_account_code: null, is_active: false },
    { code: "PROD-1155", financial_account_code: null, is_active: false },
    { code: "PROD-1156", financial_account_code: null, is_active: false },
    { code: "PROD-1157", financial_account_code: null, is_active: false },
    { code: "PROD-1158", financial_account_code: null, is_active: false },
    { code: "PROD-1159", financial_account_code: null, is_active: false },
    { code: "PROD-1160", financial_account_code: null, is_active: false },
    { code: "PROD-1161", financial_account_code: null, is_active: false },
    { code: "PROD-1162", financial_account_code: null, is_active: false },
    { code: "PROD-1163", financial_account_code: null, is_active: false },
    { code: "PROD-1164", financial_account_code: null, is_active: false },
    { code: "PROD-1165", financial_account_code: null, is_active: false },
    { code: "PROD-1166", financial_account_code: null, is_active: false },
    { code: "PROD-1167", financial_account_code: null, is_active: false },
    { code: "PROD-1168", financial_account_code: null, is_active: false },
    { code: "PROD-1169", financial_account_code: null, is_active: false },
    { code: "PROD-1170", financial_account_code: null, is_active: false },
    { code: "PROD-1171", financial_account_code: null, is_active: false },
    { code: "PROD-1172", financial_account_code: null, is_active: false },
    { code: "PROD-1173", financial_account_code: null, is_active: false },
    { code: "PROD-1174", financial_account_code: null, is_active: false },
    { code: "PROD-1175", financial_account_code: null, is_active: false },
    { code: "PROD-1176", financial_account_code: null, is_active: false },
    { code: "PROD-1177", financial_account_code: null, is_active: false },
    { code: "PROD-1178", financial_account_code: null, is_active: false },
    { code: "PROD-1179", financial_account_code: null, is_active: false },
    { code: "PROD-1180", financial_account_code: null, is_active: false },
    { code: "PROD-1181", financial_account_code: null, is_active: false },
    { code: "PROD-1182", financial_account_code: null, is_active: false },
    { code: "PROD-1183", financial_account_code: null, is_active: false },
    { code: "PROD-1184", financial_account_code: null, is_active: false },
    { code: "PROD-1185", financial_account_code: null, is_active: false },
    { code: "PROD-1186", financial_account_code: null, is_active: false },
    { code: "PROD-1187", financial_account_code: null, is_active: false },
    { code: "PROD-1188", financial_account_code: null, is_active: false },
    { code: "PROD-1189", financial_account_code: null, is_active: false },
    { code: "PROD-1190", financial_account_code: null, is_active: false },
    { code: "PROD-1191", financial_account_code: null, is_active: false },
    { code: "PROD-1192", financial_account_code: null, is_active: false },
    { code: "PROD-1193", financial_account_code: null, is_active: false },
    { code: "PROD-1194", financial_account_code: null, is_active: false },
    { code: "PROD-1195", financial_account_code: null, is_active: false },
    { code: "PROD-1196", financial_account_code: null, is_active: false },
    // Continuação produtos ativos
    { code: "PROD-1197", financial_account_code: "103.0", is_active: true },
    { code: "PROD-375", financial_account_code: "104.0", is_active: true },
    { code: "PROD-374", financial_account_code: "101.5", is_active: true },
    { code: "PROD-366", financial_account_code: "101.1", is_active: true },
    { code: "PROD-367", financial_account_code: "103.0", is_active: true },
    // TEST products - inativos
    { code: "PROD-1401", financial_account_code: null, is_active: false },
    { code: "PROD-1402", financial_account_code: null, is_active: false },
    { code: "PROD-363", financial_account_code: null, is_active: false },
    { code: "PROD-364", financial_account_code: null, is_active: false },
    { code: "PROD-365", financial_account_code: null, is_active: false },
    { code: "PROD-378", financial_account_code: null, is_active: false },
    { code: "PROD-165", financial_account_code: null, is_active: false },
    { code: "PROD-380", financial_account_code: null, is_active: false },
    { code: "PROD-166", financial_account_code: null, is_active: false },
    { code: "PROD-362", financial_account_code: null, is_active: false },
    { code: "PROD-360", financial_account_code: null, is_active: false },
    { code: "PROD-1348", financial_account_code: null, is_active: false },
    { code: "PROD-1349", financial_account_code: null, is_active: false },
    { code: "PROD-361", financial_account_code: null, is_active: false },
    { code: "PROD-1346", financial_account_code: null, is_active: false },
    // Últimos produtos ativos
    { code: "PROD-1406", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1409", financial_account_code: "103.0", is_active: true },
    { code: "PROD-369", financial_account_code: "103.0", is_active: true },
    { code: "PROD-368", financial_account_code: "103.0", is_active: true },
    { code: "PROD-370", financial_account_code: "103.0", is_active: true },
    { code: "PROD-167", financial_account_code: "103.0", is_active: true },
    { code: "PROD-1413", financial_account_code: "101.1", is_active: true },
    { code: "PROD-1412", financial_account_code: "105.1", is_active: true },
];

async function updateProducts() {
    console.log(`\n=== Atualizando ${productUpdates.length} produtos ===\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const update of productUpdates) {
        const updateData = {
            is_active: update.is_active,
            financial_account_code: update.financial_account_code,
            financial_account_id: null, // limpar o campo UUID antigo
        };

        const { error } = await supabase
            .from("products")
            .update(updateData)
            .eq("code", update.code);

        if (error) {
            console.error(`❌ Erro ao atualizar ${update.code}: ${error.message}`);
            errorCount++;
        } else {
            const status = update.is_active ? "✅" : "🚫";
            const account = update.financial_account_code || "null";
            console.log(`${status} ${update.code} → financial_account: ${account}, is_active: ${update.is_active}`);
            successCount++;
        }
    }

    console.log(`\n=== RESUMO ===`);
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`⏭️ Ignorados: ${skippedCount}`);

    // Mostrar estatísticas finais
    const { data: stats } = await supabase
        .from("products")
        .select("is_active, financial_account_code")
        .order("code");

    if (stats) {
        const active = stats.filter((p) => p.is_active).length;
        const inactive = stats.filter((p) => !p.is_active).length;
        const withAccount = stats.filter((p) => p.financial_account_code).length;
        const withoutAccount = stats.filter((p) => !p.financial_account_code).length;

        console.log(`\n=== ESTATÍSTICAS DA BASE ===`);
        console.log(`📦 Total produtos: ${stats.length}`);
        console.log(`✅ Ativos: ${active}`);
        console.log(`🚫 Inativos: ${inactive}`);
        console.log(`💰 Com Financial Account: ${withAccount}`);
        console.log(`❓ Sem Financial Account: ${withoutAccount}`);
    }
}

updateProducts().catch(console.error);
