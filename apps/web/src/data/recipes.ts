import type { LocalText, RecipeCard } from "../model";
import { northIndianRecipes } from "./recipesNorth";

const t = (en: string, hi: string, hiLatn: string): LocalText => ({ en, hi, "hi-Latn": hiLatn });

const coreRecipes: RecipeCard[] = [
  {
    id: "dal-tadka",
    slug: "dal-tadka",
    title: t("Dal Tadka", "दाल तड़का", "Dal Tadka"),
    headnote: t(
      "A North Indian home-style arhar dal, pressure-cooked until soft and finished with a bright cumin-garlic tadka. Comforting, forgiving, and deeply everyday.",
      "उत्तर भारतीय घरों वाली नरम अरहर दाल, ऊपर से जीरा-लहसुन का खुशबूदार तड़का। सुकून देने वाली, आसान और रोज़मर्रा की अपनी दाल।",
      "Ghar wali naram arhar dal, upar se jeera-lehsun ka khushbudaar tadka. Comforting, forgiving aur bilkul roz wali."
    ),
    region: t("North India", "उत्तर भारत", "North India"),
    timeMin: 38,
    difficulty: t("Easy", "आसान", "Aasaan"),
    tags: ["everyday", "satvik", "guests"],
    servingsBase: 4,
    cookware: t("3–5 L pressure cooker + small tadka pan", "3–5 लीटर प्रेशर कुकर + छोटी तड़का पैन", "3–5 L pressure cooker + chhota tadka pan"),
    offlineReady: true,
    palette: ["#D79A3B", "#7A211D"],
    photo: "dal-tadka",
    ingredients: [
      { id: "toor", name: t("Arhar/toor dal", "अरहर/तूर दाल", "Arhar/toor dal"), qty: 200, unit: "g", prep: t("rinsed until water is almost clear", "पानी लगभग साफ़ होने तक धोई हुई", "paani lagbhag saaf hone tak dhuli"), curve: "linear", substitutions: [{ name: t("Yellow moong dal", "पीली मूंग दाल", "Peeli moong dal"), ratio: "1:1", note: t("Cooks faster and tastes lighter; use 2 whistles.", "जल्दी पकेगी और हल्की लगेगी; 2 सीटी रखें।", "Jaldi pakegi aur halki lagegi; 2 seeti rakho.") }] },
      { id: "water", name: t("Water", "पानी", "Paani"), qty: 650, unit: "ml", prep: t("plus more to adjust", "ज़रूरत पर थोड़ा और", "zarurat par thoda aur"), curve: "water" },
      { id: "tomato", name: t("Tomato", "टमाटर", "Tamatar"), qty: 160, unit: "g", prep: t("finely chopped", "बारीक कटा", "bareek kata"), curve: "linear", substitutions: [{ name: t("Tomato purée", "टमाटर प्यूरी", "Tomato puree"), ratio: "120 ml", note: t("Use less water and cook until the raw smell goes.", "पानी थोड़ा कम करें और कच्ची खुशबू जाने तक पकाएँ।", "Paani thoda kam karo aur kacchi khushbu jaane tak pakao.") }] },
      { id: "chilli", name: t("Green chilli", "हरी मिर्च", "Hari mirchi"), qty: 2, unit: "piece", prep: t("slit lengthwise", "लंबाई में चीरी", "lambai mein cheeri"), curve: "chilli" },
      { id: "turmeric", name: t("Turmeric", "हल्दी", "Haldi"), qty: 2, unit: "g", prep: t("measured", "नापी हुई", "naapi hui"), curve: "linear" },
      { id: "salt", name: t("Salt", "नमक", "Namak"), qty: 7, unit: "g", prep: t("keep half for finishing", "आधा अंत के लिए रखें", "aadha end ke liye rakho"), curve: "linear" },
      { id: "ghee", name: t("Ghee", "घी", "Ghee"), qty: 25, unit: "g", prep: t("divided", "दो हिस्सों में", "do hisson mein"), curve: "linear", substitutions: [{ name: t("Mustard oil", "सरसों का तेल", "Sarson ka tel"), ratio: "1:1", note: t("Sharper, eastern-style finish; smoke it lightly first.", "स्वाद थोड़ा तेज़ और पूर्वी होगा; पहले हल्का धुआँ आने दें।", "Swaad thoda tez aur eastern hoga; pehle halka smoke aane do.") }] },
      { id: "cumin", name: t("Cumin seeds", "जीरा", "Jeera"), qty: 5, unit: "g", prep: t("ready by the stove", "चूल्हे के पास तैयार", "stove ke paas ready"), curve: "whole-spice" },
      { id: "garlic", name: t("Garlic", "लहसुन", "Lehsun"), qty: 15, unit: "g", prep: t("thinly sliced", "पतला कटा", "patla kata"), curve: "linear", substitutions: [{ name: t("Asafoetida", "हींग", "Hing"), ratio: "2 pinches", note: t("Satvik option; bloom for only 5 seconds.", "सात्विक विकल्प; सिर्फ़ 5 सेकंड चटकाएँ।", "Satvik option; sirf 5 second khilao.") }] },
      { id: "chilli-dry", name: t("Dried red chilli", "सूखी लाल मिर्च", "Sukhi lal mirchi"), qty: 2, unit: "piece", prep: t("torn once", "एक बार तोड़ी हुई", "ek baar todi hui"), curve: "chilli" },
      { id: "coriander", name: t("Coriander", "हरा धनिया", "Hara dhaniya"), qty: 15, unit: "g", prep: t("roughly chopped", "मोटा कटा", "mota kata"), curve: "linear" },
      { id: "lemon", name: t("Lemon", "नींबू", "Nimbu"), qty: 1, unit: "piece", prep: t("cut in half", "आधा कटा", "aadha kata"), curve: "linear", substitutions: [{ name: t("Amchur", "अमचूर", "Amchur"), ratio: "½ tsp", note: t("Stir in after switching off the flame.", "आँच बंद करके मिलाएँ।", "Aanch band karke milao.") }] }
    ],
    steps: [
      {
        id: "rinse",
        n: 1,
        text: t("Rinse the dal, then add it to the cooker with water, turmeric and half the salt.", "दाल धोकर कुकर में पानी, हल्दी और आधा नमक डालें।", "Dal dho kar cooker mein paani, haldi aur aadha namak daalo."),
        spoken: t("Rinsed dal goes into the cooker now, with water, turmeric and half the salt.", "धुली दाल कुकर में डालें—साथ में पानी, हल्दी और आधा नमक।", "Dhuli dal cooker mein daal do—saath mein paani, haldi aur aadha namak."),
        cue: t("The water should sit about two fingers above the dal.", "पानी दाल से करीब दो उँगली ऊपर रहे।", "Paani dal se kareeb do ungli upar rahe."),
        photo: "stage-dal-rinse",
        attention: "active",
        risk: "normal",
        flame: 1,
        stage: "prep",
        recovery: [{ id: "too-much-water", failure: t("There seems to be too much water", "पानी ज़्यादा लग रहा है", "Paani zyada lag raha hai"), fix: t("That’s okay. Keep it; we can simmer uncovered after pressure cooking.", "ठीक है। रहने दें; प्रेशर के बाद बिना ढक्कन उबालकर गाढ़ा कर लेंगे।", "Theek hai. Rehne do; pressure ke baad khula simmer karke gaadha kar lenge.") }]
      },
      {
        id: "pressure",
        n: 2,
        text: t("Seal the cooker. Keep high flame for 3 whistles, then low for 5 minutes.", "कुकर बंद करें। तेज़ आँच पर 3 सीटी, फिर धीमी आँच पर 5 मिनट।", "Cooker band karo. Tez aanch par 3 seeti, phir dheemi aanch par 5 minute."),
        spoken: t("Cooker lock kar do. Three whistles on high; I’ll count with you. Then five minutes on low.", "कुकर लॉक करें। तेज़ आँच पर तीन सीटी—मैं साथ गिनूँगा। फिर पाँच मिनट धीमी आँच।", "Cooker lock kar do. Tez aanch par teen seeti—main saath ginunga. Phir paanch minute low."),
        cue: t("A steady whistle, not steam leaking around the lid.", "सीटी साफ़ आए; ढक्कन के किनारे से भाप न निकले।", "Seeti saaf aaye; lid ke kinaare se steam leak na ho."),
        photo: "stage-pressure-cooker",
        attention: "passive",
        risk: "high",
        checkInIntervalSec: 45,
        flame: 5,
        whistles: { count: 3, thenFlame: 2, thenDurationSec: 300, manualFallback: t("Tap +1 after every whistle if the kitchen is too noisy.", "रसोई बहुत शोर वाली हो तो हर सीटी पर +1 दबाएँ।", "Kitchen noisy ho toh har seeti par +1 dabao.") },
        cookware: t("If steam leaks, cool fully before checking the gasket.", "भाप लीक हो तो पूरी तरह ठंडा करके ही गैस्केट देखें।", "Steam leak ho toh poora thanda karke gasket check karo."),
        stage: "pressure",
        recovery: [
          { id: "steam-leak", failure: t("Steam is leaking from the side", "किनारे से भाप निकल रही है", "Side se steam nikal rahi hai"), question: t("Is the whistle weight seated properly?", "क्या सीटी ठीक से लगी है?", "Kya whistle weight theek se lagi hai?"), fix: t("Switch off the flame. Do not touch the lid. Let pressure fall completely, then reseat the gasket and try again.", "आँच बंद करें। ढक्कन न छुएँ। दबाव पूरी तरह गिरने दें, फिर गैस्केट सही लगाकर दोबारा करें।", "Aanch band karo. Lid mat chhoo. Pressure poora girne do, phir gasket theek karke dobara karo.") },
          { id: "no-whistle", failure: t("No whistle is coming", "सीटी नहीं आ रही", "Seeti nahi aa rahi"), question: t("Can you see steam escaping anywhere?", "क्या कहीं से भाप निकलती दिख रही है?", "Kahin se steam nikalti dikh rahi hai?"), fix: t("If there is no leak, raise the flame one level and wait two minutes. Never force the lid.", "लीक नहीं है तो आँच एक स्तर बढ़ाकर दो मिनट देखें। ढक्कन ज़बरदस्ती न खोलें।", "Leak nahi hai toh aanch ek level badha kar do minute dekho. Lid force mat karo.") }
        ]
      },
      {
        id: "release",
        n: 3,
        text: t("Switch off. Let the pressure release naturally for 8 minutes before opening.", "आँच बंद करें। खोलने से पहले 8 मिनट दबाव अपने आप निकलने दें।", "Aanch band karo. Kholne se pehle 8 minute pressure naturally nikalne do."),
        spoken: t("Flame off. Ab cooker ko aath minute bilkul chhedna nahi—pressure apne aap niklega.", "आँच बंद। अब कुकर को आठ मिनट बिल्कुल न छेड़ें—दबाव अपने आप निकलेगा।", "Flame off. Ab cooker ko aath minute bilkul chhedna nahi—pressure apne aap niklega."),
        cue: t("The pressure pin must drop fully before the lid moves.", "ढक्कन घुमाने से पहले प्रेशर पिन पूरी तरह नीचे हो।", "Lid ghumane se pehle pressure pin poora neeche ho."),
        photo: "stage-pressure-cooker",
        durationSec: 480,
        attention: "passive",
        risk: "high",
        checkInIntervalSec: 120,
        flame: 1,
        stage: "rest",
        recovery: [{ id: "pin-up", failure: t("The pressure pin is still up", "प्रेशर पिन अभी ऊपर है", "Pressure pin abhi upar hai"), fix: t("Wait. Do not run water over a hot cooker or force the lid. It will drop safely.", "इंतज़ार करें। गर्म कुकर पर पानी न डालें और ढक्कन न खींचें। पिन सुरक्षित रूप से नीचे आएगी।", "Wait karo. Garam cooker par paani mat daalo aur lid force mat karo. Pin safely neeche aa jayegi.") }]
      },
      {
        id: "mash",
        n: 4,
        text: t("Open safely, whisk the dal smooth, then simmer with tomato and green chilli.", "सुरक्षित ढंग से खोलें, दाल फेंटें, फिर टमाटर और हरी मिर्च के साथ उबालें।", "Safe tareeke se kholo, dal ko whisk karo, phir tamatar aur hari mirchi ke saath simmer karo."),
        spoken: t("Pin is down? Great. Open away from your face, whisk the dal, then add tomato and green chilli.", "पिन नीचे है? बढ़िया। चेहरा दूर रखकर खोलें, दाल फेंटें, फिर टमाटर और हरी मिर्च डालें।", "Pin neeche hai? Badhiya. Face se door khol kar dal whisk karo, phir tamatar aur hari mirchi daalo."),
        cue: t("The dal should coat the spoon but still pour easily.", "दाल चम्मच पर चढ़े, पर आसानी से बह भी जाए।", "Dal spoon ko coat kare, par aasani se pour bhi ho."),
        photo: "stage-dal-cooked",
        durationSec: 360,
        attention: "active",
        risk: "normal",
        flame: 3,
        stage: "simmer",
        recovery: [
          { id: "too-thick", failure: t("The dal is too thick", "दाल बहुत गाढ़ी है", "Dal bahut gaadhi hai"), fix: t("Add hot water, one small splash at a time, whisking between each.", "गरम पानी थोड़ा-थोड़ा डालें और हर बार फेंटें।", "Garam paani chhote splash mein daalo, har baar whisk karo.") },
          { id: "too-thin", failure: t("The dal is watery", "दाल पतली है", "Dal patli hai"), fix: t("Simmer uncovered on medium flame for 4–6 minutes. Stir every minute.", "बिना ढक्कन मध्यम आँच पर 4–6 मिनट उबालें। हर मिनट चलाएँ।", "Khuli medium flame par 4–6 minute simmer karo. Har minute chalao.") }
        ]
      },
      {
        id: "tadka-heat",
        n: 5,
        text: t("Heat ghee in the tadka pan on medium flame. Add cumin.", "तड़का पैन में मध्यम आँच पर घी गरम करें। जीरा डालें।", "Tadka pan mein medium aanch par ghee garam karo. Jeera daalo."),
        spoken: t("Tadka time. Medium flame, ghee in the small pan, then jeera. Crackle is the cue—not smoke.", "अब तड़का। छोटी पैन, मध्यम आँच, घी और फिर जीरा। चटकना चाहिए, धुआँ नहीं।", "Ab tadka. Chhota pan, medium aanch, ghee aur phir jeera. Chatakna chahiye, smoke nahi."),
        cue: t("Cumin should crackle in 3–5 seconds without darkening at once.", "जीरा 3–5 सेकंड में चटके, तुरंत काला न हो।", "Jeera 3–5 second mein chatke, turant kaala na ho."),
        photo: "stage-jeera-fry",
        durationSec: 20,
        attention: "active",
        risk: "high",
        checkInIntervalSec: 15,
        flame: 3,
        cookware: t("A thin pan heats quickly; lower the flame early.", "पतली पैन जल्दी गरम होगी; आँच पहले ही कम करें।", "Patla pan jaldi heat hoga; flame pehle hi kam karo."),
        stage: "temper",
        recovery: [{ id: "jeera-burnt", failure: t("The cumin turned black", "जीरा काला हो गया", "Jeera kaala ho gaya"), fix: t("Discard this tadka and wipe the pan. Burnt cumin stays bitter; restart on lower flame with fresh ghee.", "यह तड़का फेंककर पैन पोंछें। जला जीरा कड़वा रहेगा; कम आँच पर नए घी से फिर शुरू करें।", "Yeh tadka discard karke pan wipe karo. Jala jeera kadwa rahega; lower flame par fresh ghee se restart karo.") }]
      },
      {
        id: "tadka-aromatics",
        n: 6,
        text: t("Add garlic and dried chilli. Stir until the garlic edges turn pale gold.", "लहसुन और सूखी मिर्च डालें। लहसुन के किनारे हल्के सुनहरे होने तक चलाएँ।", "Lehsun aur sukhi mirchi daalo. Lehsun ke edges pale golden hone tak chalao."),
        spoken: t("Garlic and dry chilli go in. Keep it moving—pale gold edges are perfect; dark brown is too far.", "लहसुन और सूखी मिर्च डालें। चलाते रहें—किनारे हल्के सुनहरे हों, गहरे भूरे नहीं।", "Lehsun aur sukhi mirchi daalo. Chalate raho—edges pale golden, dark brown nahi."),
        cue: t("Nutty aroma, pale-gold garlic edges, no harsh smoke.", "भुनी खुशबू, हल्के सुनहरे किनारे, तेज़ धुआँ नहीं।", "Nutty khushbu, pale-gold edges, harsh smoke nahi."),
        photo: "stage-tadka",
        durationSec: 35,
        attention: "active",
        risk: "high",
        checkInIntervalSec: 12,
        flame: 2,
        stage: "temper",
        recovery: [
          { id: "garlic-fast", failure: t("The garlic is browning too fast", "लहसुन बहुत जल्दी भूरा हो रहा है", "Lehsun bahut jaldi brown ho raha hai"), question: t("Is it already dark brown or only golden?", "क्या गहरा भूरा हो गया या सिर्फ़ सुनहरा है?", "Dark brown ho gaya ya sirf golden hai?"), fix: t("Lift the pan off the heat now. If only golden, pour it into the dal. If dark and bitter-smelling, restart the tadka.", "पैन तुरंत आँच से हटाएँ। सिर्फ़ सुनहरा है तो दाल में डालें। गहरा और कड़वी खुशबू है तो तड़का दोबारा बनाएँ।", "Pan abhi heat se hatao. Sirf golden hai toh dal mein daal do. Dark aur bitter smell hai toh tadka restart karo.") },
          { id: "chilli-smoke", failure: t("The chilli smoke is making me cough", "मिर्च का धुआँ खाँसी करा रहा है", "Mirchi ka smoke khansi kara raha hai"), fix: t("Switch off and move the pan away. Ventilate the kitchen. Skip the dried chilli in the fresh tadka.", "आँच बंद करके पैन दूर रखें। रसोई में हवा आने दें। नए तड़के में सूखी मिर्च छोड़ दें।", "Aanch band karke pan door rakho. Kitchen ventilate karo. Fresh tadka mein dry chilli skip karo.") }
        ]
      },
      {
        id: "combine",
        n: 7,
        text: t("Pour the hot tadka over the simmering dal. Cover for 30 seconds, then stir.", "गरम तड़का उबलती दाल पर डालें। 30 सेकंड ढकें, फिर मिलाएँ।", "Garam tadka simmering dal par daalo. 30 second dhako, phir milao."),
        spoken: t("Pour the tadka over the dal—carefully, it may splutter. Cover for thirty seconds so the aroma stays in.", "तड़का दाल पर सावधानी से डालें—छींटे आ सकते हैं। खुशबू रोकने के लिए तीस सेकंड ढक दें।", "Tadka dal par carefully daalo—splutter ho sakta hai. Khushbu ke liye 30 second cover karo."),
        cue: t("The surface should shimmer with red-gold ghee and cumin.", "ऊपर लाल-सुनहरे घी और जीरे की चमक दिखे।", "Upar red-golden ghee aur jeera ki shine dikhe."),
        photo: "dal-tadka",
        durationSec: 30,
        attention: "active",
        risk: "high",
        checkInIntervalSec: 15,
        flame: 2,
        stage: "finish",
        recovery: [{ id: "splatter", failure: t("It splattered", "छींटे पड़े", "Splatter hua"), fix: t("Step back and lower the flame. Pour down the side of the pot next time, not into the centre.", "पीछे हटें और आँच कम करें। अगली बार बीच में नहीं, बर्तन के किनारे से डालें।", "Peechhe hato aur flame low karo. Next time centre mein nahi, pot ke side se daalo.") }]
      },
      {
        id: "finish",
        n: 8,
        text: t("Taste for salt. Finish with coriander and lemon after switching off the flame.", "नमक चखें। आँच बंद करके हरा धनिया और नींबू डालें।", "Namak taste karo. Flame off karke hara dhaniya aur nimbu daalo."),
        spoken: t("Flame off. Taste once, add the remaining salt if needed, then coriander and lemon. Dal tadka is ready.", "आँच बंद। एक बार चखें, ज़रूरत हो तो बाकी नमक, फिर धनिया और नींबू। दाल तड़का तैयार है।", "Flame off. Ek baar taste karo, zarurat ho toh baaki namak, phir dhaniya aur nimbu. Dal tadka ready hai."),
        cue: t("Balanced salt, gentle tang, and a pourable creamy body.", "नमक संतुलित, हल्की खटास और बहने वाली मलाईदार दाल।", "Balanced namak, halki khataas aur pourable creamy dal."),
        photo: "dal-tadka",
        attention: "active",
        risk: "normal",
        flame: 1,
        stage: "finish",
        recovery: [
          { id: "too-salty", failure: t("It is too salty", "नमक ज़्यादा है", "Namak zyada hai"), fix: t("Add hot water and a spoon of cooked unsalted dal if available. Simmer two minutes; do not add lemon yet.", "गरम पानी और हो तो एक चम्मच बिना नमक की पकी दाल डालें। दो मिनट उबालें; अभी नींबू न डालें।", "Garam paani aur available ho toh unsalted cooked dal ka spoon daalo. Do minute simmer; abhi nimbu mat daalo.") },
          { id: "flat", failure: t("The flavour feels flat", "स्वाद फीका लग रहा है", "Swaad flat lag raha hai"), fix: t("Add a pinch of salt and a squeeze of lemon, then taste again before adding more.", "एक चुटकी नमक और थोड़ा नींबू डालें, फिर और डालने से पहले चखें।", "Ek pinch namak aur thoda nimbu daalo, phir aur add karne se pehle taste karo.") }
        ]
      }
    ]
  },
  {
    id: "jeera-rice",
    slug: "jeera-rice",
    title: t("Jeera Rice", "जीरा राइस", "Jeera Rice"),
    headnote: t("Separate, fragrant grains with cumin — built to finish alongside dal.", "जीरे की खुशबू वाले खिले-खिले चावल—दाल के साथ समय पर तैयार।", "Jeera ki khushbu wale khile chawal—dal ke saath time par ready."),
    region: t("North India", "उत्तर भारत", "North India"),
    timeMin: 26,
    difficulty: t("Easy", "आसान", "Aasaan"),
    tags: ["everyday", "satvik", "vrat"],
    servingsBase: 4,
    cookware: t("Heavy saucepan with lid", "भारी ढक्कन वाली पतीली", "Heavy lid wali pateeli"),
    offlineReady: true,
    palette: ["#E8D6A8", "#A66B2D"],
    photo: "jeera-rice",
    ingredients: [
      { id: "rice", name: t("Basmati rice", "बासमती चावल", "Basmati chawal"), qty: 250, unit: "g", prep: t("rinsed and soaked 20 minutes", "धोकर 20 मिनट भिगोया", "dho kar 20 minute bhigoya"), curve: "linear" },
      { id: "water", name: t("Water", "पानी", "Paani"), qty: 400, unit: "ml", prep: t("measured", "नापा हुआ", "naapa hua"), curve: "water" },
      { id: "cumin", name: t("Cumin seeds", "जीरा", "Jeera"), qty: 5, unit: "g", prep: t("ready", "तैयार", "ready"), curve: "whole-spice" },
      { id: "ghee", name: t("Ghee", "घी", "Ghee"), qty: 15, unit: "g", prep: t("measured", "नापा हुआ", "naapa hua"), curve: "linear" }
    ],
    steps: [
      { id: "bloom", n: 1, text: t("Heat ghee and crackle cumin.", "घी गरम करके जीरा चटकाएँ।", "Ghee garam karke jeera chatkao."), spoken: t("Medium flame. Ghee, then cumin—wait for the crackle.", "मध्यम आँच। घी, फिर जीरा—चटकने दें।", "Medium flame. Ghee, phir jeera—chatakne do."), cue: t("A nutty aroma without smoke.", "भुनी खुशबू, धुआँ नहीं।", "Nutty khushbu, smoke nahi."), photo: "stage-tadka", durationSec: 25, attention: "active", risk: "high", checkInIntervalSec: 15, flame: 3, stage: "temper", recovery: [{ id: "burn", failure: t("Cumin burned", "जीरा जल गया", "Jeera jal gaya"), fix: t("Restart with fresh ghee on lower flame.", "नए घी से कम आँच पर फिर शुरू करें।", "Fresh ghee se lower flame par restart karo.") }] },
      { id: "simmer", n: 2, text: t("Add drained rice, water and salt. Bring to a boil, then cover on low.", "छने चावल, पानी और नमक डालें। उबाल आने पर ढककर धीमी आँच करें।", "Drained chawal, paani aur namak daalo. Boil aaye toh cover karke low karo."), spoken: t("Rice and water in. One boil, then lid on and flame low.", "चावल और पानी डालें। एक उबाल, फिर ढक्कन और धीमी आँच।", "Rice aur water in. Ek boil, phir lid aur low flame."), cue: t("Small steam holes appear across the surface.", "ऊपर छोटे भाप के छेद दिखें।", "Surface par chhote steam holes dikhein."), photo: "stage-rice-cooked", durationSec: 720, attention: "passive", risk: "normal", flame: 2, stage: "simmer", recovery: [{ id: "dry", failure: t("Rice looks dry too soon", "चावल जल्दी सूखे लग रहे हैं", "Rice jaldi dry lag raha hai"), fix: t("Sprinkle 2 tablespoons hot water, cover, and keep the lowest flame.", "2 बड़े चम्मच गरम पानी छिड़कें, ढकें और सबसे धीमी आँच रखें।", "2 tbsp garam paani sprinkle karo, cover karke lowest flame rakho.") }] },
      { id: "rest", n: 3, text: t("Switch off and rest covered for 8 minutes. Fluff gently.", "आँच बंद करके 8 मिनट ढका रहने दें। हल्के हाथ से खोलें।", "Flame off karke 8 minute covered rest. Halke haath fluff karo."), spoken: t("Flame off. Don’t peek for eight minutes; the steam is finishing the grains.", "आँच बंद। आठ मिनट ढक्कन न खोलें; भाप चावल पूरा करेगी।", "Flame off. Aath minute mat kholo; steam grains finish karegi."), cue: t("Long separate grains, no water at the bottom.", "लंबे खिले दाने, नीचे पानी नहीं।", "Long separate grains, bottom mein paani nahi."), photo: "jeera-rice", durationSec: 480, attention: "passive", risk: "normal", flame: 1, stage: "rest", recovery: [{ id: "sticky", failure: t("Rice is sticky", "चावल चिपचिपे हैं", "Rice sticky hai"), fix: t("Spread gently on a wide plate for 3 minutes; do not keep stirring.", "चौड़ी प्लेट पर 3 मिनट हल्का फैला दें; बार-बार न चलाएँ।", "Wide plate par 3 minute gently spread karo; baar-baar mat chalao.") }] }
    ]
  },
  {
    id: "aloo-gobi",
    slug: "aloo-gobi",
    title: t("Aloo Gobi", "आलू गोभी", "Aloo Gobi"),
    headnote: t("A dry, everyday sabzi with browned cauliflower edges and tender potatoes.", "भुने किनारों वाली गोभी और नरम आलू की रोज़ वाली सूखी सब्ज़ी।", "Bhune edges wali gobhi aur naram aloo ki roz wali sukhi sabzi."),
    region: t("Punjab", "पंजाब", "Punjab"),
    timeMin: 34,
    difficulty: t("Medium", "मध्यम", "Medium"),
    tags: ["everyday", "satvik"],
    servingsBase: 4,
    cookware: t("Wide steel kadhai", "चौड़ी स्टील कड़ाही", "Wide steel kadhai"),
    offlineReady: true,
    palette: ["#C78527", "#6F5E2E"],
    photo: "aloo-gobi",
    ingredients: [
      { id: "potato", name: t("Potato", "आलू", "Aloo"), qty: 300, unit: "g", prep: t("2 cm cubes", "2 सेमी टुकड़े", "2 cm cubes"), curve: "linear" },
      { id: "cauliflower", name: t("Cauliflower", "फूलगोभी", "Phool gobhi"), qty: 450, unit: "g", prep: t("medium florets, dried well", "मध्यम फूल, अच्छी तरह सूखे", "medium florets, achchhe se dry"), curve: "linear" },
      { id: "oil", name: t("Mustard oil", "सरसों का तेल", "Sarson ka tel"), qty: 30, unit: "ml", prep: t("measured", "नापा हुआ", "naapa hua"), curve: "linear" },
      { id: "spice", name: t("Turmeric + coriander powder", "हल्दी + धनिया पाउडर", "Haldi + dhaniya powder"), qty: 12, unit: "g", prep: t("mixed", "मिले हुए", "mixed"), curve: "whole-spice" }
    ],
    steps: [
      { id: "potato", n: 1, text: t("Brown potatoes in hot oil on medium-high flame.", "गरम तेल में आलू मध्यम-तेज़ आँच पर भूनें।", "Garam tel mein aloo medium-high par bhuno."), spoken: t("Potatoes first. Let one side brown before moving them.", "पहले आलू। एक तरफ़ रंग आने दें, फिर चलाएँ।", "Pehle aloo. Ek side brown hone do, phir chalao."), cue: t("Golden patches on at least two sides.", "कम से कम दो तरफ़ सुनहरे निशान।", "Kam se kam do sides golden patches."), photo: "stage-aloo-fry", durationSec: 420, attention: "active", risk: "high", checkInIntervalSec: 60, flame: 4, stage: "temper", recovery: [{ id: "stick", failure: t("Potatoes are sticking", "आलू चिपक रहे हैं", "Aloo chipak rahe hain"), fix: t("Lower the flame, add one teaspoon oil around the edge, and wait 30 seconds before lifting.", "आँच कम करें, किनारे से एक चम्मच तेल डालें और उठाने से पहले 30 सेकंड रुकें।", "Flame low karo, edge se 1 tsp oil aur lift karne se pehle 30 second wait.") }] },
      { id: "gobi", n: 2, text: t("Add cauliflower and spices. Cover on medium-low, stirring gently twice.", "गोभी और मसाले डालें। मध्यम-धीमी आँच पर ढकें, दो बार हल्के चलाएँ।", "Gobhi aur masale daalo. Medium-low par cover, do baar gently chalao."), spoken: t("Gobhi and spices in. Cover it; we’ll turn it only twice so the florets stay whole.", "गोभी और मसाले डालें। ढकें; सिर्फ़ दो बार चलाएँ ताकि फूल साबुत रहें।", "Gobhi aur masale in. Cover; sirf do baar chalaenge taaki florets whole rahein."), cue: t("A knife enters the potato with slight resistance.", "चाकू आलू में हल्के दबाव से जाए।", "Knife aloo mein halki resistance se jaaye."), photo: "aloo-gobi", durationSec: 720, attention: "passive", risk: "normal", flame: 2, stage: "simmer", recovery: [{ id: "mushy", failure: t("Cauliflower is breaking", "गोभी टूट रही है", "Gobhi toot rahi hai"), fix: t("Stop stirring. Cook uncovered for the remaining time so moisture escapes.", "चलाना बंद करें। बचा समय बिना ढक्कन पकाएँ ताकि नमी निकले।", "Stir mat karo. Baaki time uncovered cook karo taaki moisture nikle.") }] },
      { id: "finish", n: 3, text: t("Uncover, raise the flame for 2 minutes, and finish with coriander.", "ढक्कन हटाकर 2 मिनट आँच तेज़ करें और धनिया डालें।", "Uncover karke 2 minute flame high karo, phir dhaniya."), spoken: t("Last two minutes uncovered on high—just enough for those roasted edges.", "अंत के दो मिनट बिना ढक्कन तेज़ आँच—बस भुने किनारों के लिए।", "Last do minute uncovered high—bas roasted edges ke liye."), cue: t("Dry pan, browned edges, tender centres.", "पैन सूखी, किनारे भुने, अंदर नरम।", "Pan dry, edges bhune, centre tender."), photo: "aloo-gobi", durationSec: 120, attention: "active", risk: "high", checkInIntervalSec: 45, flame: 4, stage: "finish", recovery: [{ id: "dry", failure: t("The spices look dry and powdery", "मसाले सूखे और पाउडर जैसे हैं", "Masale dry aur powdery lag rahe hain"), fix: t("Sprinkle one tablespoon water around the edge, toss once, and cover for one minute.", "किनारे से एक बड़ा चम्मच पानी छिड़कें, एक बार मिलाएँ और एक मिनट ढकें।", "Edge se 1 tbsp water sprinkle karo, ek toss aur 1 minute cover.") }] }
    ]
  }
];

export const recipes: RecipeCard[] = [...coreRecipes, ...northIndianRecipes];

export const recipeById = (id: string): RecipeCard => recipes.find((recipe) => recipe.id === id) ?? recipes[0]!;
