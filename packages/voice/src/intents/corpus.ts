import type { Intent, VoiceLocale } from "./types.js";

type LocaleCorpus = Record<VoiceLocale, readonly string[]>;

export const EXEMPLAR_BASES: Readonly<Record<Intent, LocaleCorpus>> = {
  advance: {
    en: ["next step", "move to the next step", "continue with the recipe", "this step is done", "tell me what comes next"],
    hi: ["अगला कदम बताओ", "आगे बढ़ो", "यह चरण हो गया", "खाना बनाना जारी रखो", "अब आगे क्या है"],
    hinglish: ["agla step batao", "aage badho", "yeh step ho gaya", "recipe continue karo", "ab next kya hai"]
  },
  "go-back": {
    en: ["previous step", "go back one step", "show the last instruction", "return to the earlier step", "I missed the step before"],
    hi: ["पिछला कदम दिखाओ", "एक चरण पीछे जाओ", "पिछली हिदायत बताओ", "पहले वाले चरण पर लौटो", "मुझसे पिछला कदम छूट गया"],
    hinglish: ["pichla step dikhao", "ek step peeche jao", "last instruction batao", "pehle wale step par lauto", "previous step miss ho gaya"]
  },
  repeat: {
    en: ["repeat this step", "say that again", "read the current instruction again", "I did not hear you", "what did you just say"],
    hi: ["यह कदम फिर से बोलो", "दोबारा बताओ", "अभी वाली हिदायत फिर पढ़ो", "मैं सुन नहीं पाया", "तुमने अभी क्या कहा"],
    hinglish: ["yeh step phir se bolo", "dobara batao", "current instruction repeat karo", "main sun nahi paya", "abhi kya bola"]
  },
  "quantity-query": {
    en: ["how much cumin do I add", "what quantity is needed", "how many spoons should I use", "tell me the ingredient amount", "what amount goes in"],
    hi: ["कितना जीरा डालना है", "कितनी मात्रा चाहिए", "कितने चम्मच डालूँ", "सामग्री की मात्रा बताओ", "इसमें कितना जाएगा"],
    hinglish: ["kitna jeera dalna hai", "quantity kitni chahiye", "kitne chammach use karun", "ingredient amount batao", "isme kitna jayega"]
  },
  "timer-query": {
    en: ["how much time is left", "what is remaining on the timer", "tell me the time left", "when will the countdown finish", "check the running timer"],
    hi: ["कितना समय बचा है", "टाइमर में कितना बाकी है", "बचा हुआ समय बताओ", "उलटी गिनती कब खत्म होगी", "चल रहा टाइमर देखो"],
    hinglish: ["kitna time bacha hai", "timer mein kitna baaki hai", "time left batao", "countdown kab finish hoga", "running timer check karo"]
  },
  "flame-query": {
    en: ["what flame level should I use", "how high should the heat be", "tell me the gas setting", "what induction level is needed", "should the flame be low or high"],
    hi: ["आँच कितनी रखनी है", "गर्मी कितनी तेज हो", "गैस की सेटिंग बताओ", "इंडक्शन किस स्तर पर रखूँ", "आँच धीमी हो या तेज"],
    hinglish: ["aanch kitni rakhni hai", "heat kitni high ho", "gas setting batao", "induction level kya rakhu", "flame low ya high"]
  },
  troubleshoot: {
    en: ["something is wrong", "the food is burning", "the mixture is too thin", "this does not look right", "help me fix the dish"],
    hi: ["कुछ गड़बड़ है", "खाना जल रहा है", "मिश्रण बहुत पतला है", "यह सही नहीं लग रहा", "इसे ठीक करने में मदद करो"],
    hinglish: ["kuch gadbad hai", "khana jal raha hai", "mixture bahut patla hai", "yeh sahi nahi lag raha", "dish fix karne mein help karo"]
  },
  "pause-everything": {
    en: ["stop everything", "pause the cooking", "hold all the timers", "wait and stop now", "freeze the whole session"],
    hi: ["सब कुछ रोक दो", "खाना बनाना रोक दो", "सारे टाइमर रोक दो", "रुको अभी", "पूरा सत्र थाम दो"],
    hinglish: ["sab kuch rok do", "cooking pause karo", "saare timer hold karo", "ruko abhi", "whole session freeze karo"]
  },
  "switch-dish": {
    en: ["switch to the rice", "focus on the dal", "go to the sabzi", "change the active dish", "show me the other dish"],
    hi: ["चावल पर जाओ", "दाल पर ध्यान दो", "सब्ज़ी पर चलो", "अभी वाला पकवान बदलो", "दूसरा पकवान दिखाओ"],
    hinglish: ["rice par switch karo", "dal par focus karo", "sabzi pe chalo", "active dish change karo", "dusri dish dikhao"]
  },
  "whistle-report": {
    en: ["one whistle happened", "count a whistle", "add one cooker whistle", "that was a whistle", "the cooker just whistled"],
    hi: ["एक सीटी हुई", "एक सीटी गिनो", "कुकर की एक सीटी जोड़ो", "वह सीटी थी", "कुकर ने अभी सीटी दी"],
    hinglish: ["ek seeti hui", "one whistle count karo", "ek cooker seeti add karo", "woh whistle thi", "cooker ne abhi seeti di"]
  },
  "substitute-query": {
    en: ["I do not have amchur", "what can replace cumin", "what can I use instead", "suggest an ingredient substitute", "swap this ingredient"],
    hi: ["मेरे पास अमचूर नहीं है", "जीरे की जगह क्या डालूँ", "इसके बदले क्या इस्तेमाल करूँ", "सामग्री का विकल्प बताओ", "यह सामग्री बदल दो"],
    hinglish: ["amchur nahi hai", "jeera replace kaise karun", "iske badle kya use karun", "ingredient substitute batao", "yeh ingredient swap karo"]
  }
};

export const EVAL_BASES: Readonly<Record<Intent, LocaleCorpus>> = {
  advance: {
    en: ["show the next step", "go to the following step", "carry on with the recipe", "I have finished this step", "what is the next instruction"],
    hi: ["अगला चरण दिखाओ", "आगे चलते हैं", "रेसिपी जारी रखो", "यह कदम पूरा हो गया", "अगली हिदायत क्या है"],
    hinglish: ["next step dikhao", "aage chalo", "recipe aage continue karo", "yeh wala step complete hai", "agli instruction batao"]
  },
  "go-back": {
    en: ["go to the previous step", "take me back one step", "show the instruction before this", "return to the last step", "move one step backward"],
    hi: ["पिछले चरण पर जाओ", "मुझे एक कदम पीछे ले चलो", "इससे पहले की हिदायत दिखाओ", "आखिरी चरण पर लौटो", "एक कदम पीछे चलो"],
    hinglish: ["previous step par jao", "mujhe ek step back le jao", "isse pehle wali instruction dikhao", "last step par return karo", "one step backward chalo"]
  },
  repeat: {
    en: ["repeat the instruction", "say the current step again", "read it once more", "tell me that again", "I missed what you said"],
    hi: ["हिदायत दोहराओ", "अभी का कदम फिर बताओ", "इसे एक बार और पढ़ो", "वह फिर से कहो", "आपने जो कहा वह छूट गया"],
    hinglish: ["instruction repeat karo", "current step dobara bolo", "ek baar aur read karo", "woh phir se batao", "jo bola woh miss ho gaya"]
  },
  "quantity-query": {
    en: ["how much of this ingredient", "give me the required quantity", "number of spoons needed", "what is the measurement", "how much should go into the pan"],
    hi: ["यह सामग्री कितनी चाहिए", "ज़रूरी मात्रा बताओ", "कितने चम्मच चाहिए", "इसका नाप क्या है", "कड़ाही में कितना डालूँ"],
    hinglish: ["yeh ingredient kitna chahiye", "required quantity batao", "spoons kitne chahiye", "iska measurement kya hai", "pan mein kitna dalun"]
  },
  "timer-query": {
    en: ["how long is left", "give me the timer remainder", "what time remains", "when does this timer end", "show the active countdown"],
    hi: ["और कितना समय है", "टाइमर का बाकी समय बताओ", "कितना वक्त रह गया", "यह टाइमर कब पूरा होगा", "चालू उलटी गिनती दिखाओ"],
    hinglish: ["aur kitna time hai", "timer ka remainder batao", "kitna waqt left hai", "yeh timer kab end hoga", "active countdown dikhao"]
  },
  "flame-query": {
    en: ["tell me the flame setting", "what heat level now", "how should I set the burner", "which induction number", "is this low medium or high heat"],
    hi: ["आँच की सेटिंग बताओ", "अभी गर्मी का स्तर क्या हो", "बर्नर कैसे रखूँ", "इंडक्शन का कौन सा नंबर", "यह धीमी मध्यम या तेज आँच है"],
    hinglish: ["flame setting batao", "abhi heat level kya ho", "burner kaise set karun", "induction kaunsa number", "low medium ya high heat"]
  },
  troubleshoot: {
    en: ["there is a problem", "it looks like it is burning", "this is too watery", "the dish looks wrong", "how do I rescue this"],
    hi: ["यहाँ समस्या है", "लगता है जल रहा है", "यह बहुत पानी जैसा है", "पकवान गलत लग रहा है", "इसे कैसे बचाऊँ"],
    hinglish: ["problem ho gayi", "lagta hai burn ho raha hai", "yeh too watery hai", "dish wrong lag rahi hai", "isko rescue kaise karun"]
  },
  "pause-everything": {
    en: ["pause everything now", "stop the cooking session", "pause every timer", "hold on and wait", "freeze cooking for a while"],
    hi: ["अभी सब रोक दो", "खाना बनाने का सत्र रोक दो", "हर टाइमर थाम दो", "ठहरो और रुको", "कुछ देर खाना बनाना थामो"],
    hinglish: ["ab sab pause karo", "cooking session stop karo", "every timer pause karo", "hold on ruko", "thodi der cooking freeze karo"]
  },
  "switch-dish": {
    en: ["take me to rice", "make dal the focus", "open the sabzi steps", "select another active dish", "move over to the other dish"],
    hi: ["मुझे चावल पर ले चलो", "दाल को सामने लाओ", "सब्ज़ी के कदम खोलो", "दूसरा पकवान चुनो", "दूसरे पकवान पर जाओ"],
    hinglish: ["mujhe rice par le jao", "dal ko focus banao", "sabzi steps kholo", "another active dish select karo", "other dish pe move karo"]
  },
  "whistle-report": {
    en: ["there has been one whistle", "record this whistle", "increment the cooker count", "I heard a whistle", "the pressure cooker whistled"],
    hi: ["एक सीटी हो चुकी", "यह सीटी दर्ज करो", "कुकर की गिनती बढ़ाओ", "मैंने सीटी सुनी", "प्रेशर कुकर ने सीटी दी"],
    hinglish: ["one seeti ho gayi", "yeh whistle record karo", "cooker count increment karo", "maine seeti suni", "pressure cooker whistle hua"]
  },
  "substitute-query": {
    en: ["this ingredient is missing", "give me a replacement for cumin", "what else can work here", "find an ingredient alternative", "can I replace this item"],
    hi: ["यह सामग्री नहीं है", "जीरे का दूसरा विकल्प दो", "यहाँ और क्या चल सकता है", "सामग्री का दूसरा विकल्प खोजो", "क्या मैं इसे बदल सकता हूँ"],
    hinglish: ["yeh ingredient missing hai", "cumin ka replacement do", "yahan aur kya use ho sakta hai", "ingredient alternative dhundo", "kya main isko replace kar sakta hun"]
  }
};

export const TRAINING_TEMPLATES: Readonly<Record<VoiceLocale, readonly string[]>> = {
  en: ["{phrase}", "please {phrase}", "{phrase} now", "listen {phrase}", "while cooking {phrase}"],
  hi: ["{phrase}", "कृपया {phrase}", "अभी {phrase}", "सुनो {phrase}", "खाना बनाते समय {phrase}"],
  hinglish: ["{phrase}", "please {phrase}", "ab {phrase}", "suno {phrase}", "cooking ke time {phrase}"]
};

export const EVAL_TEMPLATES: Readonly<Record<VoiceLocale, readonly string[]>> = {
  en: ["{phrase} please", "hey {phrase}", "{phrase} right now", "during this recipe {phrase}", "{phrase} for me"],
  hi: ["{phrase} प्लीज़", "अरे {phrase}", "{phrase} अभी", "इस रेसिपी में {phrase}", "मेरे लिए {phrase}"],
  hinglish: ["{phrase} please", "hey {phrase}", "{phrase} abhi", "iss recipe mein {phrase}", "mere liye {phrase}"]
};

export function applyTemplate(template: string, phrase: string): string {
  return template.replace("{phrase}", phrase);
}
