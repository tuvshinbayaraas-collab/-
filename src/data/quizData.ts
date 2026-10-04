import { CategoryId, CategoryInfo, Question } from '../types/quiz';

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  science: {
    id: 'science',
    name: 'Шинжлэх ухаан',
    description: 'Сонирхолтой шинжлэх ухааны баримтууд, нээлтүүд',
    iconName: 'Atom',
    color: '#06b6d4',
    accentBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
  general_knowledge: {
    id: 'general_knowledge',
    name: 'Ерөнхий мэдлэг',
    description: 'Дэлхий ертөнцийн ашигтай, гайхалтай баримтууд',
    iconName: 'Globe',
    color: '#3b82f6',
    accentBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  history: {
    id: 'history',
    name: 'Түүх',
    description: 'Түүхэн чухал үйл явдал, суут хүмүүс',
    iconName: 'Scroll',
    color: '#f59e0b',
    accentBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  technology: {
    id: 'technology',
    name: 'Технологи ба хиймэл оюун',
    description: 'Компьютер, AI, шинэ бүтээл, орчин үеийн дэвшил',
    iconName: 'Cpu',
    color: '#8b5cf6',
    accentBg: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  },
  geography: {
    id: 'geography',
    name: 'Газар зүй',
    description: 'Улс орнууд, байгалийн дурсгал, хотууд, дэлхийн гайхамшиг',
    iconName: 'Compass',
    color: '#10b981',
    accentBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  logic: {
    id: 'logic',
    name: 'Логик ба сэтгэхүй',
    description: 'Тархины дасгал, логик сэтгэлгээ, оньсого мэт бодлого',
    iconName: 'Brain',
    color: '#ec4899',
    accentBg: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  },
  entertainment: {
    id: 'entertainment',
    name: 'Кино, урлаг ба энтертайнмент',
    description: 'Кино урлаг, хөгжим, поп соёл, сонирхолтой урлаг',
    iconName: 'Film',
    color: '#f43f5e',
    accentBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  nature: {
    id: 'nature',
    name: 'Байгаль ба амьтад',
    description: 'Амьтдын ертөнц, ургамал, далай тэнгис, сонин амьтад',
    iconName: 'Trees',
    color: '#84cc16',
    accentBg: 'bg-lime-500/10 text-lime-400 border-lime-500/30',
  },
  sports: {
    id: 'sports',
    name: 'Спорт',
    description: 'Олимп, дэлхийн спортын амжилтууд, алдарт тамирчид',
    iconName: 'Trophy',
    color: '#eab308',
    accentBg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  culture: {
    id: 'culture',
    name: 'Соёл ба уламжлал',
    description: 'Монгол өв соёл, ёс заншил, дэлхийн өвөрмөц уламжлал',
    iconName: 'Flame',
    color: '#f97316',
    accentBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
};

export const CATEGORY_KEYS: CategoryId[] = [
  'science',
  'general_knowledge',
  'history',
  'technology',
  'geography',
  'logic',
  'entertainment',
  'nature',
  'sports',
  'culture',
];

export const QUESTION_POOL: Record<CategoryId, Question[]> = {
  science: [
    {
      id: 'sci_1',
      categoryKey: 'science',
      categoryName: 'Шинжлэх ухаан',
      question: 'Нарны гэрэл Дэлхийд хүрч ирэхэд ойролцоогоор хэдий хэр хугацаа зарцуулдаг вэ?',
      options: [
        { id: 'A', text: '8 секунд' },
        { id: 'B', text: '8 минут 20 секунд' },
        { id: 'C', text: '1 цаг' },
        { id: 'D', text: '24 минут' },
      ],
      correctOptionId: 'B',
      explanation: 'Нар ба Дэлхийн хоорондох зай ойролцоогоор 149.6 сая км бөгөөд вакуум дахь гэрлийн хурдаар (300,000 км/сек) аялахад яг 8 минут 20 секунд шаардагддаг.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'sci_2',
      categoryKey: 'science',
      categoryName: 'Шинжлэх ухаан',
      question: 'Хүний биеийн хамгийн том эрхтэн юу вэ?',
      options: [
        { id: 'A', text: 'Элэг' },
        { id: 'B', text: 'Арьс' },
        { id: 'C', text: 'Тархи' },
        { id: 'D', text: 'Уушги' },
      ],
      correctOptionId: 'B',
      explanation: 'Хүний арьс нь насанд хүрсэн хүний биеийн жингийн 16 орчим хувийг эзэлдэг бөгөөд 1.5–2 метр квадрат талбайтайгаар хүний хамгийн том эрхтэн юм.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'sci_3',
      categoryKey: 'science',
      categoryName: 'Шинжлэх ухаан',
      question: 'Нарны аймгийн аль гариг нарыг хамгийн хурдан бүтэн тойрдог вэ?',
      options: [
        { id: 'A', text: 'Буд (Меркури)' },
        { id: 'B', text: 'Сугар (Венера)' },
        { id: 'C', text: 'Ангараг (Марс)' },
        { id: 'D', text: 'Бархасбадь (Юпитер)' },
      ],
      correctOptionId: 'A',
      explanation: 'Буд гариг нь нартай хамгийн ойр оршдог ба секундэд 47 км-ийн хурдтайгаар ердөө 88 хоногт нарыг нэг бүтэн тойрдог.',
      difficulty: 'Дунд',
    },
  ],

  general_knowledge: [
    {
      id: 'gen_1',
      categoryKey: 'general_knowledge',
      categoryName: 'Ерөнхий мэдлэг',
      question: 'Дэлхийн далай тэнгисийн хамгийн гүн цэг болох Мариан хотгорын гүн ойролцоогоор хэдэн метр вэ?',
      options: [
        { id: 'A', text: '5,400 метр' },
        { id: 'B', text: '8,848 метр' },
        { id: 'C', text: '11,034 метр' },
        { id: 'D', text: '14,200 метр' },
      ],
      correctOptionId: 'C',
      explanation: 'Мариан хотгорын "Челленджерийн ангал" нь ойролцоогоор 11,034 метр гүн бөгөөд дэлхийн хамгийн өндөр оргил болох Эверестийг бүтэн живүүлж дахин 2 км илүү гарах хэмжээтэй юм.',
      difficulty: 'Дунд',
    },
    {
      id: 'gen_2',
      categoryKey: 'general_knowledge',
      categoryName: 'Ерөнхий мэдлэг',
      question: 'Дэлхийн хамгийн том арал аль нь вэ?',
      options: [
        { id: 'A', text: 'Мадагаскар' },
        { id: 'B', text: 'Гренланд' },
        { id: 'C', text: 'Борнео' },
        { id: 'D', text: 'Шинэ Гвиней' },
      ],
      correctOptionId: 'B',
      explanation: 'Гренланд нь 2.16 сая хавтгай дөрвөлжин км талбайтайгаар тив биш хамгийн том арал хэмээн тооцогддог.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'gen_3',
      categoryKey: 'general_knowledge',
      categoryName: 'Ерөнхий мэдлэг',
      question: 'Хүний нийт 206 ясны талаас илүү хувь нь биеийн аль хэсэгт байдаг вэ?',
      options: [
        { id: 'A', text: 'Нуруу ба хавирга' },
        { id: 'B', text: 'Гар ба хөлийн сарвуу' },
        { id: 'C', text: 'Гавал ба хүзүү' },
        { id: 'D', text: 'Аарцаг ба дал' },
      ],
      correctOptionId: 'B',
      explanation: 'Хүний хоёр гар ба хоёр хөлийн сарвуунд нийт 106 яс байрладаг бөгөөд энэ нь хүний биеийн нийт 206 ясны талаас илүү хувийг бүрдүүлдэг.',
      difficulty: 'Хүнд',
    },
  ],

  history: [
    {
      id: 'his_1',
      categoryKey: 'history',
      categoryName: 'Түүх',
      question: 'Их Монгол Улсыг Их Хуралдайгаар хэдэн онд тунхаглан зарласан бэ?',
      options: [
        { id: 'A', text: '1162 он' },
        { id: 'B', text: '1206 он' },
        { id: 'C', text: '1227 он' },
        { id: 'D', text: '1279 он' },
      ],
      correctOptionId: 'B',
      explanation: '1206 оны улаан барс жил Онон мөрний хөвөөнд хуралдсан Их Хуралдайгаар Тэмүжинг Чингис хаанд өргөмжилж, Их Монгол Улсыг тунхагласан түүхтэй.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'his_2',
      categoryKey: 'history',
      categoryName: 'Түүх',
      question: 'Эртний ертөнцийн 7 гайхамшгаас өнөө үед бүрэн бүтэн үлдсэн цорын ганц байгууламж аль нь вэ?',
      options: [
        { id: 'A', text: 'Гизагийн Их Пирамид' },
        { id: 'B', text: 'Семирамисын дүүжин цэцэрлэг' },
        { id: 'C', text: 'Александрын гэрэлт цамхаг' },
        { id: 'D', text: 'Родосын аварга хөшөө' },
      ],
      correctOptionId: 'A',
      explanation: 'МЭӨ 2560 онд баригдсан Египетийн Гизагийн Их Пирамид нь 4500 гаруй жилийн турш хадгалагдан үлдсэн эртний 7 гайхамшгийн цорын ганц дурсгал юм.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'his_3',
      categoryKey: 'history',
      categoryName: 'Түүх',
      question: '1903 онд дэлхийн түүхэнд анх удаа хөдөлгүүрт нисэх онгоцоор амжилттай ниссэн ах дүүсийг хэн гэдэг вэ?',
      options: [
        { id: 'A', text: 'Ах дүү Монгольфье' },
        { id: 'B', text: 'Ах дүү Райт' },
        { id: 'C', text: 'Ах дүү Люмьер' },
        { id: 'D', text: 'Ах дүү Гримм' },
      ],
      correctOptionId: 'B',
      explanation: 'Орвилл ба Уилбур Райт нар 1903 оны 12 дугаар сарын 17-нд АНУ-д анхны моторын хүчээр ажиллах онгоцоор хүн төрөлхтний агаарын тээврийн эрин үеийг нээжээ.',
      difficulty: 'Дунд',
    },
  ],

  technology: [
    {
      id: 'tech_1',
      categoryKey: 'technology',
      categoryName: 'Технологи ба хиймэл оюун',
      question: 'Хиймэл оюун ухааны сорил буюу машины сэтгэх чадварыг шалгах сорилыг 1950 онд анх дэвшүүлсэн эрдэмтэн хэн бэ?',
      options: [
        { id: 'A', text: 'Алан Тьюринг' },
        { id: 'B', text: 'Жон фон Нейман' },
        { id: 'C', text: 'Чарльз Бэббиж' },
        { id: 'D', text: 'Билл Гейтс' },
      ],
      correctOptionId: 'A',
      explanation: 'Компьютерийн шинжлэх ухааны суурийг тавьсан Их Британийн эрдэмтэн Алан Тьюринг "Тьюрингийн сорил" (Turing Test)-ыг зохиосон билээ.',
      difficulty: 'Дунд',
    },
    {
      id: 'tech_2',
      categoryKey: 'technology',
      categoryName: 'Технологи ба хиймэл оюун',
      question: 'Орчин үеийн хиймэл оюунд түгээмэл хэрэглэгддэг "LLM" товчлол юу гэсэн утгатай вэ?',
      options: [
        { id: 'A', text: 'Large Logic Module' },
        { id: 'B', text: 'Large Language Model' },
        { id: 'C', text: 'Linear Learning Machine' },
        { id: 'D', text: 'Linked Linguistic Matrix' },
      ],
      correctOptionId: 'B',
      explanation: 'LLM (Large Language Model буюу Их хэлний загвар) нь асар их бичвэр өгөгдөл дээр суралцсан, байгалийн хэлийг ойлгож боловсруулах загвар юм.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'tech_3',
      categoryKey: 'technology',
      categoryName: 'Технологи ба хиймэл оюун',
      question: 'Түүхэн дэх анхны компьютерийн программын алгоритмыг бичсэн дэлхийн анхны программист хэн бэ?',
      options: [
        { id: 'A', text: 'Грейс Хоппер' },
        { id: 'B', text: 'Ада Лавлейс' },
        { id: 'C', text: 'Маргарет Хамилтон' },
        { id: 'D', text: 'Кэтрин Жонсон' },
      ],
      correctOptionId: 'B',
      explanation: 'Английн яруу найрагч Байроны охин Ада Лавлейс нь 1843 онд аналитик хөдөлгүүрт зориулан анхны алгоритмыг нийтлүүлсэн түүхтэй.',
      difficulty: 'Хүнд',
    },
  ],

  geography: [
    {
      id: 'geo_1',
      categoryKey: 'geography',
      categoryName: 'Газар зүй',
      question: 'Дэлхийн хамгийн олон хүн амтай далайд гарцгүй орон аль нь вэ?',
      options: [
        { id: 'A', text: 'Казахстан' },
        { id: 'B', text: 'Этоп' },
        { id: 'C', text: 'Монгол' },
        { id: 'D', text: 'Боливи' },
      ],
      correctOptionId: 'B',
      explanation: 'Этиоп улс нь 120 сая гаруй хүн амтайгаар дэлхийн хамгийн олон хүнтэй далайд гарцгүй орон бөгөөд нутаг дэвсгэрийн хэмжээгээр хамгийн том нь Казахстан юм.',
      difficulty: 'Дунд',
    },
    {
      id: 'geo_2',
      categoryKey: 'geography',
      categoryName: 'Газар зүй',
      question: 'Монгол орны хамгийн өндөр цэг болох Хүйтний оргил (4,374 м) аль уулсын нуруунд байрладаг вэ?',
      options: [
        { id: 'A', text: 'Хангайн нуруу' },
        { id: 'B', text: 'Алтай Таван Богд' },
        { id: 'C', text: 'Хэнтийн нуруу' },
        { id: 'D', text: 'Говь Алтайн нуруу' },
      ],
      correctOptionId: 'B',
      explanation: 'Баян-Өлгий аймаг дахь Алтай Таван Богд уулын Хүйтний оргил нь далайн түвшнээс дээш 4,374 метр өндөртэй Монгол орны ноён оргил билээ.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'geo_3',
      categoryKey: 'geography',
      categoryName: 'Газар зүй',
      question: 'Урт нь 6,650 км бөгөөд дэлхийн хамгийн урт мөрөнд албан ёсоор тооцогддог мөрөн аль нь вэ?',
      options: [
        { id: 'A', text: 'Амазон' },
        { id: 'B', text: 'Нил' },
        { id: 'C', text: 'Хөх мөрөн (Янцзы)' },
        { id: 'D', text: 'Миссисипи' },
      ],
      correctOptionId: 'B',
      explanation: 'Африк тивийн Нил мөрөн 6,650 км урттайгаар дэлхийн хамгийн урт мөрөнд бүртгэгддэг бол Амазон мөрөн нь усны эзлэхүүнээрээ хамгийн том нь юм.',
      difficulty: 'Хөнгөн',
    },
  ],

  logic: [
    {
      id: 'log_1',
      categoryKey: 'logic',
      categoryName: 'Логик ба сэтгэхүй',
      question: 'Нэгэн саванд байгаа бактери минут тутамд 2 дахин үрждэг. Хэрэв сав 60 минутад дүүрдэг бол сав яг тал хүртлээ хэдэн минутад дүүрсэн бэ?',
      options: [
        { id: 'A', text: '30 минут' },
        { id: 'B', text: '45 минут' },
        { id: 'C', text: '59 минут' },
        { id: 'D', text: '50 минут' },
      ],
      correctOptionId: 'C',
      explanation: 'Бактери минут тутамд 2 дахин үрждэг тул 59 дэх минутад савны тал хувь дүүрсэн байх ба дараагийн 1 минутад (60 дахь минутад) 2 дахин ихсэж бүрэн дүүрнэ!',
      difficulty: 'Дунд',
    },
    {
      id: 'log_2',
      categoryKey: 'logic',
      categoryName: 'Логик ба сэтгэхүй',
      question: 'Хэрэв 5 машин 5 минутад 5 ширхэг бүтээгдэхүүн үйлдвэрлэдэг бол 100 машин 100 ширхэг бүтээгдэхүүнийг хэдэн минутад үйлдвэрлэх вэ?',
      options: [
        { id: 'A', text: '100 минут' },
        { id: 'B', text: '20 минут' },
        { id: 'C', text: '5 минут' },
        { id: 'D', text: '1 минут' },
      ],
      correctOptionId: 'C',
      explanation: '1 машин 1 бүтээгдэхүүнийг 5 минутад үйлдвэрлэдэг. Иймд 100 машин нэгэн зэрэг ажиллаад 100 бүтээгдэхүүнийг мөн л 5 минутад үйлдвэрлэнэ.',
      difficulty: 'Дунд',
    },
    {
      id: 'log_3',
      categoryKey: 'logic',
      categoryName: 'Логик ба сэтгэхүй',
      question: 'Дараах тоон дарааллын дараагийн зөв тоог ол: 2, 3, 5, 7, 11, 13, ... ?',
      options: [
        { id: 'A', text: '15' },
        { id: 'B', text: '17' },
        { id: 'C', text: '19' },
        { id: 'D', text: '21' },
      ],
      correctOptionId: 'B',
      explanation: 'Энэ нь 1 ба зөвхөн өөртөө хуваагддаг "Анхны тоонууд"-ын цуваа юм. 15 нь 3 ба 5-д хуваагддаг тул анхны тоо биш, харин 17 нь дараагийн анхны тоо мөн.',
      difficulty: 'Хөнгөн',
    },
  ],

  entertainment: [
    {
      id: 'ent_1',
      categoryKey: 'entertainment',
      categoryName: 'Кино, урлаг ба энтертайнмент',
      question: 'Оскарын наадмаас түүхэнд хамгийн олон буюу 11 Оскарын шагнал хүртсэн алдарт 3 бүтээлийн нэг аль нь вэ?',
      options: [
        { id: 'A', text: 'Аватар (2009)' },
        { id: 'B', text: 'Титаник (1997)' },
        { id: 'C', text: 'Загалмайлсан эцэг (1972)' },
        { id: 'D', text: 'Оддын дайн (1977)' },
      ],
      correctOptionId: 'B',
      explanation: 'Оскарын наадмын түүхэнд Бен-Гур (1959), Титаник (1997), Бөгжний эзэн: Хаан эргэж ирсэн нь (2003) гурван бүтээл тус бүр 11 Оскар хүртэж дээд амжилт тогтоосон.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'ent_2',
      categoryKey: 'entertainment',
      categoryName: 'Кино, урлаг ба энтертайнмент',
      question: 'Леонардо да Винчигийн "Мона Лиза" бүтээл өнөөдөр аль хотын аль музейд байнгын үзмэр болон хадгалагддаг вэ?',
      options: [
        { id: 'A', text: 'Парис, Луврын музей' },
        { id: 'B', text: 'Мадрид, Прадо музей' },
        { id: 'C', text: 'Нью-Йорк, Метрополитен музей' },
        { id: 'D', text: 'Санкт-Петербург, Эрмитаж' },
      ],
      correctOptionId: 'A',
      explanation: 'Мона Лиза нь Францын Парис хотын Луврын музейд сум үл нэвтрэх шилэн хоргонд тусгай цаг уурын хяналт дор хадгалагддаг.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'ent_3',
      categoryKey: 'entertainment',
      categoryName: 'Кино, урлаг ба энтертайнмент',
      question: '300 сая гаруй хувь борлуулагдаж, түүхэн дэх хамгийн олон борлуулагдсан видео тоглоом аль нь вэ?',
      options: [
        { id: 'A', text: 'Тетрис' },
        { id: 'B', text: 'Grand Theft Auto V' },
        { id: 'C', text: 'Minecraft' },
        { id: 'D', text: 'Super Mario Bros.' },
      ],
      correctOptionId: 'C',
      explanation: 'Mojang студийн бүтээсэн "Minecraft" тоглоом 300 сая гаруй хувь борлуулагдаж дэлхийн бүх цаг үеийн шилдэг борлуулалттай тоглоом болсон.',
      difficulty: 'Дунд',
    },
  ],

  nature: [
    {
      id: 'nat_1',
      categoryKey: 'nature',
      categoryName: 'Байгаль ба амьтад',
      question: 'Дэлхийн хамгийн том амьтан болох Хөх халимны зүрх ойролцоогоор ямар зүйлтэй эн тэнцэх хэмжээтэй вэ?',
      options: [
        { id: 'A', text: 'Хүний хоёр алга шиг' },
        { id: 'B', text: 'Автомашины дугуй шиг' },
        { id: 'C', text: 'Жижиг суудлын автомашин шиг' },
        { id: 'D', text: 'Гэрийн богино долгионы зуух шиг' },
      ],
      correctOptionId: 'C',
      explanation: 'Хөх халимны зүрх 180 гаруй кг жинтэй бөгөөд жижиг оврын суудлын автомашинтай дүйцэхүйц хэмжээтэй байдаг.',
      difficulty: 'Дунд',
    },
    {
      id: 'nat_2',
      categoryKey: 'nature',
      categoryName: 'Байгаль ба амьтад',
      question: 'Бүтцийнхээ онцлогоос шалтгаалан хойшоо ухарч алхаж чаддаггүй ямар амьтан байдаг вэ?',
      options: [
        { id: 'A', text: 'Анааш' },
        { id: 'B', text: 'Кенгуру (Имж)' },
        { id: 'C', text: 'Баавгай' },
        { id: 'D', text: 'Заан' },
      ],
      correctOptionId: 'B',
      explanation: 'Кенгуру нь том хүчирхэг сүүл болон өвөрмөц хөлнийхөө бүтцээс шалтгаалан хойшоо алхаж чаддаггүй. Энэ чанараараа үргэлж урагш тэмүүлэхийг бэлгэдэн Австралийн төрийн сүлдэнд орсон байдаг.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'nat_3',
      categoryKey: 'nature',
      categoryName: 'Байгаль ба амьтад',
      question: 'Дэлхийн амьсгалах хүчилтөрөгчийн 50–80 хувийг юу үйлдвэрлэдэг вэ?',
      options: [
        { id: 'A', text: 'Амазоны ширэнгэн ой' },
        { id: 'B', text: 'Далайн фитопланктон ба замаг' },
        { id: 'C', text: 'Сибирийн тайгын шилмүүст ой' },
        { id: 'D', text: 'Африкийн саваннын өвс' },
      ],
      correctOptionId: 'B',
      explanation: 'Хүчилтөрөгчийн дийлэнх хувийг хуурай газрын мод биш, харин далай тэнгис дэх фотосинтез явуулдаг бичил биет фитопланктон болон замаг бий болгодог.',
      difficulty: 'Хүнд',
    },
  ],

  sports: [
    {
      id: 'spo_1',
      categoryKey: 'sports',
      categoryName: 'Спорт',
      question: 'Монгол Улсаас төрсөн анхны Олимпын аварга (алтан медальт) тамирчин хэн бэ?',
      options: [
        { id: 'A', text: 'Энхбатын Бадар-Ууган' },
        { id: 'B', text: 'Найдангийн Түвшинбаяр' },
        { id: 'C', text: 'Жигжидийн Мөнхбат' },
        { id: 'D', text: 'Зэвэгийн Ойдов' },
      ],
      correctOptionId: 'B',
      explanation: '2008 оны Бээжингийн Зуны Олимпын жүдо бөхийн -100 кг жинд Н.Түвшинбаяр алтан медаль хүртэж Монгол Улсын түүхэнд анхны Олимпын аварга болсон.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'spo_2',
      categoryKey: 'sports',
      categoryName: 'Спорт',
      question: 'Хөлбөмбөгийн Дэлхийн Аварга Шалгаруулах Тэмцээнд хамгийн олон удаа буюу 5 удаа түрүүлсэн улс аль нь вэ?',
      options: [
        { id: 'A', text: 'Герман' },
        { id: 'B', text: 'Итали' },
        { id: 'C', text: 'Бразил' },
        { id: 'D', text: 'Аргентин' },
      ],
      correctOptionId: 'C',
      explanation: 'Бразилын үндэсний шигшээ баг 1958, 1962, 1970, 1994, 2002 онуудад нийт 5 удаа дэлхийн цомыг өргөсөн.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'spo_3',
      categoryKey: 'sports',
      categoryName: 'Спорт',
      question: 'Олимпын түүхэнд нийт 23 алтан медаль (нийт 28 медаль) хүртэж үнэмлэхүй рекорд тогтоосон домогт тамирчин хэн бэ?',
      options: [
        { id: 'A', text: 'Усэйн Болт' },
        { id: 'B', text: 'Майкл Фелпс' },
        { id: 'C', text: 'Карл Льюис' },
        { id: 'D', text: 'Лариса Латынина' },
      ],
      correctOptionId: 'B',
      explanation: 'АНУ-ын усанд сэлэгч Майкл Фелпс 2004–2016 оны хооронд Олимпоос 23 алт, 3 мөнгө, 2 хүрэл медаль хүртсэн нь түүхэн дэх хамгийн өндөр үзүүлэлт юм.',
      difficulty: 'Дунд',
    },
  ],

  culture: [
    {
      id: 'cul_1',
      categoryKey: 'culture',
      categoryName: 'Соёл ба уламжлал',
      question: 'Монгол үндэсний баяр наадмын "Эрийн гурван наадам"-д ямар төрлүүд үндсэн төрөлд багтдаг вэ?',
      options: [
        { id: 'A', text: 'Бөх, морь, сур харваа' },
        { id: 'B', text: 'Бөх, морь, шатар' },
        { id: 'C', text: 'Бөх, сур харваа, шагай' },
        { id: 'D', text: 'Морь, сур харваа, нум сум' },
      ],
      correctOptionId: 'A',
      explanation: 'Монгол наадмын уламжлалт гурван гол төрөл нь Үндэсний бөх, Хурдан морины уралдаан, Үндэсний сур харваа юм.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'cul_2',
      categoryKey: 'culture',
      categoryName: 'Соёл ба уламжлал',
      question: 'ЮНЕСКО-гийн Соёлын биет бус өвд бүртгэгдсэн, морин хуурын аялгуугаар эх ингийг үртэй нь эвлүүлдэг гайхамшигт ёс аль нь вэ?',
      options: [
        { id: 'A', text: 'Тэмээ тамгалах ёс' },
        { id: 'B', text: 'Ингэ хөөслөх зан үйл' },
        { id: 'C', text: 'Адуу эдэлгээнд оруулах' },
        { id: 'D', text: 'Гүү барих ёслол' },
      ],
      correctOptionId: 'B',
      explanation: 'Ботгоо голсон эх ингийг морин хуурын аялгуу, уянгалаг дуугаар уяруулан ботгыг нь авахуулдаг "Ингэ хөөслөх зан үйл" нь 2015 онд ЮНЕСКО-д бүртгэгдсэн билээ.',
      difficulty: 'Хөнгөн',
    },
    {
      id: 'cul_3',
      categoryKey: 'culture',
      categoryName: 'Соёл ба уламжлал',
      question: 'Монгол гэрийн дээвэр дээр байрладаг, нарны гэрэл тусгах болон утаа гарах үүрэгтэй дугуй хэсгийг юу гэж нэрлэдэг вэ?',
      options: [
        { id: 'A', text: 'Багана' },
        { id: 'B', text: 'Тооно' },
        { id: 'C', text: 'Уни' },
        { id: 'D', text: 'Хана' },
      ],
      correctOptionId: 'B',
      explanation: 'Тооно нь монгол гэрийн төв оройд байрлах дугуй хүрээ бөгөөд гэрийн унийг түшиж, өрхөөр бүрхэгддэг гал голомтын бэлгэдэл юм.',
      difficulty: 'Хөнгөн',
    },
  ],
};

/**
 * Generates an active 10-question quiz set.
 * Exactly 10 questions: precisely one question drawn from each of the 10 categories.
 */
export function generateQuizSession(): Question[] {
  return CATEGORY_KEYS.map((catKey) => {
    const list = QUESTION_POOL[catKey];
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
  });
}

/**
 * Evaluates the final score and returns Mongolian celebratory feedback.
 */
export function getScoreEvaluation(score: number): {
  title: string;
  badge: string;
  comment: string;
  colorClass: string;
  isVictory: boolean;
} {
  if (score === 100) {
    return {
      title: 'Төгс Мэдлэгтэн!',
      badge: 'Дээд Амжилт 🏆',
      comment: 'Гайхалтай! Та 10 асуултад бүгдэд нь алдаагүй 100% зөв хариулж, 100 бүтэн оноо цуглууллаа!',
      colorClass: 'text-amber-400',
      isVictory: true,
    };
  }
  if (score >= 80) {
    return {
      title: 'Онцгой Оюунлаг!',
      badge: 'Шилдэг Үр Дүн 🌟',
      comment: 'Маш сайн! Та өргөн цар хүрээтэй мэдлэгтэйгээ баталлаа. Бараг төгс үр дүн!',
      colorClass: 'text-emerald-400',
      isVictory: true,
    };
  }
  if (score >= 60) {
    return {
      title: 'Сайн Оролдлого!',
      badge: 'Амжилттай 👍',
      comment: 'Баяр хүргэе! Та ихэнх асуултад зөв хариулж, сайн үр дүн үзүүллээ.',
      colorClass: 'text-blue-400',
      isVictory: false,
    };
  }
  if (score >= 40) {
    return {
      title: 'Дундаж Үзүүлэлт',
      badge: 'Урагшлах Боломж 💡',
      comment: 'Боломжийн эхлэл! Буруу хариулсан асуултуудын тайлбарыг уншиж мэдлэгээ баяжуулаарай.',
      colorClass: 'text-yellow-400',
      isVictory: false,
    };
  }
  return {
    title: 'Мэдлэгээ Тэлэх Цаг!',
    badge: 'Шинэ Эхлэл 📚',
    comment: 'Шантрах хэрэггүй! Сэдвүүдийг дахин сорьж, шинэ сонирхолтой баримтууд мэдэж аваарай.',
    colorClass: 'text-rose-400',
    isVictory: false,
  };
}
