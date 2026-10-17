// Nội dung worksheet "Hiểu Mình" - 30 câu hỏi để hiểu rõ bản thân và định vị sự nghiệp
// Nguồn: Worksheet_ Hiểu mình (30 câu hỏi để hiểu rõ bản thân và định vị sự nghiệp).md

export type HmOption = { label: string; desc: string };
export type HmQuestion = {
  n: number;
  part: 1 | 2 | 3;
  title: string;
  a: HmOption;
  b: HmOption;
  verify: [string, string, string];
  meaning: string[];
  example: string;
  hints: string[];
};

export const HM_PARTS = [
  {
    part: 1 as const,
    name: "Bản thân",
    range: "Câu 1-10",
    tagline: "Hiểu cách bạn vận hành",
    intro: `Nhóm câu hỏi này không quan tâm bạn giỏi gì - nó muốn biết bạn vận hành như thế nào, trong môi trường nào bạn làm việc tốt nhất, nhịp độ nào phù hợp với bạn, và cách học nào giúp bạn tiến nhanh nhất. Đây là nền tảng để bạn chọn đúng môi trường làm việc, thay vì liên tục đổ lỗi cho bản thân khi "không phù hợp".`,
  },
  {
    part: 2 as const,
    name: "Giá trị",
    range: "Câu 11-20",
    tagline: "Bạn muốn tạo ra điều gì",
    intro: `Nhóm câu hỏi này đào sâu hơn một lớp: không chỉ bạn làm việc thế nào, mà bạn muốn đóng góp điều gì, được ghi nhận ra sao, và sẵn sàng đánh đổi gì để đạt được điều đó. Đây là bộ lọc giúp bạn không chọn nghề chỉ vì lương cao hay ngành đang hot - mà vì nó thực sự phù hợp với những gì bạn coi trọng.`,
  },
  {
    part: 3 as const,
    name: "Môi trường",
    range: "Câu 21-30",
    tagline: "Bạn phát triển tốt nhất ở đâu",
    intro: `Nhóm câu hỏi này giúp bạn đánh giá môi trường làm việc - không theo tiêu chí "tốt hay xấu", mà theo tiêu chí "có phù hợp với bạn không". Một môi trường tệ với người này có thể là lý tưởng với người khác - hiểu rõ bạn cần gì từ môi trường là bước cuối cùng để ghép đúng bản thân vào đúng chỗ.`,
  },
];

export const HM_EXPECTATIONS = [
  {
    group: "📍 Tôi đang ở đâu trong hành trình sự nghiệp?",
    items: [
      "Tôi sắp ra trường và chưa biết muốn làm ngành gì",
      "Tôi đang đi làm nhưng cảm thấy công việc hiện tại không phù hợp",
      "Tôi đang cân nhắc chuyển ngành hoặc chuyển công ty",
      "Tôi muốn hiểu rõ bản thân hơn trước khi đưa ra quyết định lớn",
    ],
  },
  {
    group: "🔍 Tôi muốn hiểu rõ hơn về...",
    items: [
      "Mình phù hợp với loại công việc nào",
      "Mình phù hợp với loại môi trường làm việc nào",
      "Điều gì thực sự quan trọng với mình trong công việc",
      "Điểm mạnh của mình nằm ở đâu trong thị trường lao động",
      "Mình nên ưu tiên điều gì khi chọn công việc tiếp theo",
    ],
  },
  {
    group: "🎯 Tôi hy vọng sau khi làm xong worksheet này...",
    items: [
      "Có được bức tranh rõ hơn về bản thân để dùng trong phỏng vấn",
      "Biết mình nên tìm hiểu thêm về loại môi trường hay ngành nào",
      "Bớt phân vân và tự tin hơn vào lựa chọn của mình",
      "Có ngôn ngữ để nói về bản thân rõ hơn với mentor hoặc người thân",
      "Nhận ra điều gì đó về mình mà trước giờ chưa để ý",
    ],
  },
];

export const HM_HOW_TO = [
  `Dành 30' tập trung để hoàn thiện worksheet này nhé, bạn sẽ nhận được kết quả khiến bản thân phải "WAO"!`,
  "Chọn đáp án cho từng câu hỏi.",
  `Nếu gặp câu hỏi chưa chắc chắn về đáp án, bạn có thể bỏ qua và quay lại làm trước khi "xem kết quả".`,
  "Cố gắng trả lời các câu hỏi xác minh để xác thực đáp án bạn chọn. Bạn càng trả lời các câu hỏi xác minh, thì bản phân tích tổng hợp càng chính xác và đầy đủ.",
  "Mỗi khi đứng trước bước ngoặt sự nghiệp (mệt mỏi, kiệt sức, chán nản, muốn nghỉ việc/nhảy việc, đổi hướng công việc), hãy quay lại làm worksheet này.",
];

export const HM_QUESTIONS: HmQuestion[] = [
  // ───────────── PHẦN 1: BẢN THÂN ─────────────
  {
    n: 1, part: 1,
    title: "Bạn làm việc tốt hơn khi có deadline hay tự do?",
    a: { label: "Cần deadline", desc: "Chạy tốt nhất khi có áp lực và kỳ vọng bên ngoài" },
    b: { label: "Cần tự do", desc: "Làm tốt nhất khi tự quản lý tiến độ theo nhịp của mình" },
    verify: [
      "Nhớ lại 3 lần bạn làm việc hiệu quả nhất trong 6 tháng qua - lúc đó có deadline không?",
      "Khi không có deadline, bạn thường làm gì: bắt đầu sớm, để đến phút chót, hay không làm?",
      "Nếu được chọn: môi trường có KPI hàng tuần rõ ràng, hay môi trường tự quyết tiến độ?",
    ],
    meaning: [
      `Nhiều người cho rằng mình "thiếu kỷ luật" vì chỉ làm việc hiệu quả khi có deadline. Nhưng đây không phải lỗi tính cách - đây là thông tin về nhịp năng lượng của bạn.`,
      `Có người chạy bằng áp lực bên ngoài: deadline, KPI, kỳ vọng rõ ràng từ người khác. Họ làm tốt nhất khi biết mình phải giao cái gì, cho ai, vào lúc nào - và đây là lợi thế lớn trong môi trường nhịp nhanh như sales, agency, hay vận hành.`,
      `Có người chạy bằng động lực nội tâm: họ cần không gian để suy nghĩ, tự đặt ưu tiên và đi theo nhịp của mình. Ép họ vào deadline dày đặc không giúp họ làm tốt hơn - chỉ làm họ căng thẳng hơn. Họ phù hợp với product, strategy, nghiên cứu, hoặc làm độc lập.`,
      `Vấn đề xảy ra khi bạn ở sai môi trường: người cần deadline vào nơi không ai nhắc sẽ trôi dạt. Người cần tự do vào môi trường kiểm soát chặt sẽ bị bóp nghẹt. Ở đây không ai kém cả - chỉ là đang ở khuông nhạc không hợp mà thôi!`,
    ],
    example: `Anh Minh thực tập ở agency quảng cáo - deadline liên tục, công việc đến tay tối hôm trước phải nộp sáng hôm sau. Anh làm tốt đến mức sếp "xin" giữ lại full-time. Một năm sau, Minh chuyển sang công ty product với văn hoá tự quản lý thời gian. Không ai giao deadline cứng, chỉ có OKR theo quý. Ba tháng đầu, anh gần như không ra được việc gì ra hồn. Không phải vì kém - vì mất đi nhịp vận hành quen thuộc. Sau khi nhận ra điều này, anh tự đặt deadline giả cho bản thân và dần lấy lại phong độ. Nhưng anh thừa nhận: môi trường agency phù hợp với mình hơn nhiều.`,
    hints: [
      "A - Cần deadline: Môi trường có nhịp nhanh, đo bằng kết quả ngắn hạn (VD: sales, agency, vận hành, account management,...)",
      "B - Cần tự do: Môi trường cho phép tự quản lý tiến độ, ít supervision trực tiếp (VD: product, strategy, nghiên cứu, freelance, nội dung,...)",
    ],
  },
  {
    n: 2, part: 1,
    title: "Bạn thích bắt đầu hay hoàn thiện?",
    a: { label: "Thích bắt đầu", desc: "Nhiều ý tưởng, hứng khởi với thứ mới, giỏi khởi tạo" },
    b: { label: "Thích hoàn thiện", desc: "Kiên nhẫn, chi tiết, đưa thứ gì đó từ 80% lên 100%" },
    verify: [
      "3 dự án gần nhất bạn tham gia, bạn hứng khởi nhất ở giai đoạn nào: lúc bắt đầu, đang làm, hay sắp xong?",
      `Bạn cảm thấy thế nào khi phải "đánh bóng" một thứ đã gần xong - sửa lại lần 3, lần 4 cho hoàn hảo?`,
      "Có dự án nào bạn tự hào vì đã hoàn thành trọn vẹn không? Bạn cảm thấy thế nào khi đó?",
    ],
    meaning: [
      `Trong bất kỳ dự án nào cũng có hai giai đoạn hoàn toàn khác nhau: khởi tạo và hoàn thiện. Và hai giai đoạn này cần hai loại năng lượng, tư duy hoàn toàn khác nhau.`,
      `Người thích bắt đầu thường giàu ý tưởng, hứng khởi với thứ mới, giỏi nhìn ra cơ hội và kéo mọi người vào cuộc - họ tạo ra momentum. Nhưng khi dự án chuyển sang giai đoạn thực thi chi tiết, họ bắt đầu mất hứng.`,
      `Người thích hoàn thiện lại có sức bền đặc biệt - kiên nhẫn với từng chi tiết nhỏ, không nản khi phải làm đi làm lại, và có khả năng đưa thứ gì đó từ 80% lên 100%. Nhưng giao cho họ một tờ giấy trắng bảo "tự do làm đi", họ thường loay hoay.`,
      `Thị trường cần cả hai. Nhưng nếu nhầm vai trò - người thích bắt đầu bị kẹt trong công việc thực thi chi tiết, hoặc người thích hoàn thiện bị ép phải liên tục sáng tạo từ đầu - cả hai đều sẽ cảm thấy mình "không đủ tốt". Thực ra, họ chỉ đang đứng sai vị trí trong chuỗi giá trị.`,
    ],
    example: `Chị Linh làm marketing tại một startup - cô rất giỏi brainstorm, mỗi buổi họp đều tràn ý tưởng. Nhưng khi được giao execute một campaign từ đầu đến cuối, cô thường bỏ dở ở 70%. Sau khi ngồi lại với mentor, cô nhận ra mình là người "bắt đầu" điển hình. Cô chuyển sang vai trò Business Development - chuyên khai phá thị trường mới, sau đó bàn giao cho team vận hành. Từ đó, cô làm tốt hơn hẳn và không còn cảm giác "thiếu kiên trì" nữa.`,
    hints: [
      "A - Thích bắt đầu: Môi trường cần khởi tạo liên tục, nhiều dự án mới cùng lúc (VD: business development, creative, early-stage startup, marketing campaigns,...)",
      "B - Thích hoàn thiện: Môi trường cần thực thi chi tiết, đưa dự án đến đích (VD: operations, finance, legal, QA, project execution,...)",
    ],
  },
  {
    n: 3, part: 1,
    title: "Bạn thấy mệt vì giao tiếp hay vì suy nghĩ quá nhiều?",
    a: { label: "Mệt vì giao tiếp", desc: "Gặp gỡ, trò chuyện liên tục tiêu hao năng lượng nhanh" },
    b: { label: "Mệt vì suy nghĩ", desc: "Phân tích và ra quyết định liên tục tiêu hao năng lượng" },
    verify: [
      "Sau một ngày làm việc điển hình, bạn kiệt sức vì điều gì nhiều hơn: nói chuyện với người khác hay giải quyết vấn đề một mình?",
      `Khi cần "nạp lại năng lượng", bạn làm gì: gặp bạn bè hay ở một mình?`,
      "Công việc nào trong tuần vừa rồi khiến bạn mệt nhất? Mệt vì giao tiếp hay vì tư duy?",
    ],
    meaning: [
      `Mỗi người có một "ngân sách năng lượng" khác nhau - và cách bạn tiêu hao năng lượng nói lên rất nhiều về loại công việc bạn nên chọn.`,
      `Nếu bạn mệt vì giao tiếp - sau một ngày gặp gỡ nhiều người, trả lời liên tục, bạn cần thời gian một mình để nạp lại - đây là dấu hiệu bạn không hợp với các vai trò đòi hỏi tương tác xã hội liên tục như sales frontline, account management, hay event. Không phải bạn "không hòa đồng" - bạn chỉ cần dùng năng lượng đó đúng chỗ hơn.`,
      `Nếu bạn mệt vì suy nghĩ quá nhiều - sau một ngày phân tích, ra quyết định, giải quyết vấn đề phức tạp, bạn cần thời gian không nghĩ gì - đây là dấu hiệu bạn không hợp với các công việc đòi hỏi xử lý thông tin liên tục như data analysis chuyên sâu, strategy, hay research.`,
      `Điều này không có nghĩa là bạn không thể làm những việc đó. Nhưng nếu chọn công việc tiêu hao đúng loại năng lượng bạn có nhiều hơn, bạn sẽ bền hơn - và giỏi hơn.`,
    ],
    example: `Chị Hà làm sales B2B, mỗi ngày gặp khách hàng 5-6 cuộc, tối về chỉ muốn nằm một mình không nói chuyện với ai. Cô tự nghĩ mình "introvert bệnh lý". Sau khi trao đổi với mentor, cô nhận ra: cô không ghét giao tiếp - cô chỉ hết năng lượng xã hội nhanh hơn người khác. Khi chuyển sang inside sales (làm việc qua email và call, ít gặp mặt trực tiếp), hiệu suất cô tăng rõ rệt, và tối về cô vẫn còn sức sống.`,
    hints: [
      "A - Mệt vì giao tiếp: Môi trường ít tương tác trực tiếp, chủ yếu làm việc qua văn bản hoặc độc lập (VD: data analyst, content, research, back-end developer, finance,...)",
      "B - Mệt vì suy nghĩ: Môi trường thiên về hành động, tương tác người-người nhiều hơn phân tích sâu (VD: sales, event management, PR, customer success, HR generalist,...)",
    ],
  },
  {
    n: 4, part: 1,
    title: "Bạn học nhanh qua làm hay qua đọc/nghe?",
    a: { label: "Học qua làm", desc: "Cần thực chiến, thử-sai để hiểu và nhớ" },
    b: { label: "Học qua đọc/nghe", desc: "Cần nền tảng lý thuyết trước khi thực hành" },
    verify: [
      "Nghĩ về một kỹ năng bạn tự hào hiện nay - bạn học được nó chủ yếu bằng cách nào: đọc/xem/nghe hay tự làm?",
      "Khi gặp task hoàn toàn mới, phản ứng đầu tiên là gì: tìm tài liệu hiểu trước hay thử làm luôn rồi sai đâu sửa đó?",
      `Khi nào bạn cảm thấy "à, mình hiểu rồi" nhất: sau khi đọc về nó hay sau khi thực sự làm nó?`,
    ],
    meaning: [
      `Không phải ai học nhanh bằng cách đọc tài liệu - và không phải ai học được gì nếu chỉ được ném thẳng vào công việc. Cách tiếp nhận thông tin của bạn ảnh hưởng trực tiếp đến tốc độ phát triển trong môi trường làm việc.`,
      `Người học qua làm cần môi trường thực chiến - họ hiểu một khái niệm khi tự tay làm nó, sai nó, và sửa nó. Giải thích lý thuyết dài với họ thường không hiệu quả bằng "thử đi rồi xem". Họ phù hợp với môi trường có nhiều cơ hội thử-sai nhanh.`,
      `Người học qua đọc/nghe cần nền tảng lý thuyết trước khi hành động. Ném họ vào môi trường "tự bơi" mà không có framework, họ sẽ loay hoay và mất tự tin. Nhưng cho họ thời gian để hiểu hệ thống trước, họ sẽ thực thi rất chắc chắn.`,
      `Nếu bạn biết mình học theo cách nào, bạn có thể chủ động tìm môi trường phù hợp - thay vì ngồi trong môi trường sai và nghĩ mình "học chậm hơn người khác".`,
    ],
    example: `Tuấn Anh gia nhập một tập đoàn lớn với chương trình đào tạo management trainee 3 tháng - học lý thuyết, case study, và presentation. Sau 3 tháng, anh gần như muốn nghỉ việc vì cảm giác "chưa làm gì thật cả". Khi được phân công về một phòng thực chiến và được làm ngay từ ngày đầu, anh bật lên rất nhanh - chỉ 2 tháng là nắm rõ quy trình hơn cả những người học lý thuyết kỹ hơn anh. Anh là người học qua làm điển hình.`,
    hints: [
      "A - Học qua làm: Môi trường thực chiến, ít đào tạo lý thuyết, được thử-sai sớm (VD: startup, agency, sales, vận hành, early-stage,...)",
      "B - Học qua đọc/nghe: Môi trường có hệ thống đào tạo bài bản, onboarding rõ ràng, mentor đồng hành (VD: corporate lớn, consulting firm, ngân hàng, MNC có L&D tốt,...)",
    ],
  },
  {
    n: 5, part: 1,
    title: "Bạn có xu hướng kiểm soát hay linh hoạt?",
    a: { label: "Thích kiểm soát", desc: "Cần quy trình, scope rõ ràng, ít thay đổi đột ngột" },
    b: { label: "Thích linh hoạt", desc: "Phát triển tốt trong môi trường biến đổi liên tục" },
    verify: [
      "Khi một kế hoạch thay đổi đột ngột, phản ứng đầu tiên là gì: bực bội vì mất trật tự hay hứng khởi vì thách thức mới?",
      "Bạn làm việc tốt hơn khi có checklist chi tiết, hay khi có mục tiêu lớn và tự chọn cách làm?",
      "Nhớ lại môi trường làm việc/học tập bạn thấy thoải mái nhất - nó có cấu trúc rõ ràng hay linh hoạt?",
    ],
    meaning: [
      `Đây là một trong những câu hỏi bị hiểu nhầm nhiều nhất. "Thích kiểm soát" thường bị gán nhãn là "cứng nhắc" hay "khó thích nghi". Nhưng trong thực tế, đây là một năng lực quý giá khi đặt đúng chỗ.`,
      `Người thích kiểm soát cần cấu trúc và sự rõ ràng để hoạt động tốt nhất. Họ làm tốt khi có quy trình, scope cụ thể, và kỳ vọng rõ ràng. Đặt họ vào môi trường thay đổi liên tục mà không có framework - họ sẽ stress, không phải vì kém, mà vì thiếu điều kiện làm việc tốt.`,
      `Người thích linh hoạt cần sự biến đổi để không chán nản và mất hứng thú. Họ làm tốt khi được thử những cách mới, khi vấn đề thay đổi liên tục và không có script. Đặt họ vào môi trường quá cứng - họ sẽ bị bóp nghẹt.`,
      `Không có kiểu nào "tốt hơn". Startup cần cả hai. Corporate cũng vậy. Quan trọng là bạn biết mình thuộc kiểu nào để chọn đúng môi trường và đúng vai trò.`,
    ],
    example: `Chị Mai nghe nói về startup và nghĩ đây là nơi năng động, phù hợp với người trẻ. Cô được nhận vào một startup Series A. Nhưng sau 6 tháng, cô liên tục lo lắng vì scope công việc thay đổi hàng tuần, không ai nói rõ ưu tiên là gì, và kế hoạch hôm nay có thể bị huỷ ngày mai. Sau khi chuyển sang một MNC có quy trình rõ ràng và JD chi tiết, cô phát triển rất nhanh. Cô không kém - cô chỉ cần cấu trúc để làm tốt nhất.`,
    hints: [
      "A - Thích kiểm soát: Môi trường có quy trình rõ, scope ổn định, ít thay đổi đột ngột (VD: corporate, finance, legal, operations, project management,...)",
      "B - Thích linh hoạt: Môi trường thay đổi nhanh, scope mở rộng liên tục (VD: startup, growth roles, consulting, business development, creative,...)",
    ],
  },
  {
    n: 6, part: 1,
    title: "Bạn thích làm việc với số liệu hay cảm xúc con người?",
    a: { label: "Thiên về số liệu", desc: "Nhìn thấy logic, xu hướng và tối ưu ở mọi nơi" },
    b: { label: "Thiên về con người", desc: "Nhìn thấy động lực, cảm xúc và kết nối quan hệ" },
    verify: [
      "Khi giải quyết vấn đề, thứ bạn tìm đến đầu tiên là gì: data và số liệu, hay hỏi người liên quan đang nghĩ và cảm thấy gì?",
      "Bạn hứng thú hơn khi đọc báo cáo phân tích thị trường, hay khi nghe ai đó kể về hành trình của họ?",
      `Loại feedback nào có giá trị hơn với bạn: "con số tháng này tốt lên 20%" hay "bạn đã giúp team rất nhiều"?`,
    ],
    meaning: [
      `Đây không phải câu hỏi về IQ hay EQ - đây là câu hỏi về loại thông tin nào bạn tự nhiên chú ý và xử lý tốt hơn.`,
      `Người mạnh về số liệu nhìn thấy logic, xu hướng và sự tối ưu ở mọi nơi. Khi đối mặt với vấn đề, họ hỏi "dữ liệu nói gì?". Họ tạo ra giá trị lớn nhất khi được làm việc với hệ thống, quy trình, và con số.`,
      `Người mạnh về con người nhìn thấy động lực, cảm xúc và mối quan hệ. Khi đối mặt với vấn đề, họ hỏi "người liên quan đang cảm thấy thế nào?". Họ tạo ra giá trị lớn nhất khi được làm việc với người - tuyển dụng, đào tạo, bán hàng, xây dựng cộng đồng.`,
      `Thị trường không cần bạn cân bằng cả hai - nó cần bạn rõ ràng về điểm mạnh của mình. Nếu bạn không biết mình nghiêng về đâu, bạn dễ chọn nghề theo xu hướng và mất phương hướng sau đó.`,
    ],
    example: `Anh Phong học marketing vì nghe nói "hot". Nhưng khi làm performance marketing - công việc nặng về số liệu, A/B testing và optimization - anh thấy mình liên tục hỏi "mình đang làm gì cho người dùng vậy?" và không tìm thấy ý nghĩa. Sau khi chuyển sang brand marketing - nơi anh làm với storytelling, cảm xúc thương hiệu và hành trình người dùng - anh tìm lại được hứng thú và bắt đầu làm tốt. Không phải anh kém - anh chỉ nhầm ngách.`,
    hints: [
      "A - Số liệu: Môi trường ra quyết định bằng data, đo lường rõ ràng (VD: data analyst, finance, performance marketing, operations, BI,...)",
      "B - Con người: Môi trường cần hiểu và tác động đến hành vi/cảm xúc (VD: HR, brand marketing, education, coaching, customer success,...)",
    ],
  },
  {
    n: 7, part: 1,
    title: "Bạn có chịu được việc bị từ chối liên tục không?",
    a: { label: "Chịu được từ chối", desc: "Từ chối không ảnh hưởng nhiều, phục hồi nhanh và tiếp tục" },
    b: { label: "Khó chịu được", desc: "Bị từ chối ảnh hưởng đến năng lượng và tự tin đáng kể" },
    verify: [
      `Nhớ lại lần cuối bạn bị từ chối rõ ràng - bạn mất bao lâu để "over it" và tiếp tục?`,
      `Nếu công việc đòi hỏi nghe "không" 10 lần mỗi ngày, bạn nghĩ mình sẽ thế nào sau 1 tháng?`,
      "Bạn có xu hướng coi từ chối là phản ánh về bản thân, hay về thời điểm và hoàn cảnh?",
    ],
    meaning: [
      `Nhiều người nghĩ rào cản vào ngành sales là kỹ năng nói chuyện hay khả năng thuyết phục. Nhưng thực tế, thứ quyết định bạn có đi đường dài được trong sales hay không lại là khả năng phục hồi tâm lý sau từ chối.`,
      `Trong môi trường sales B2B, tỷ lệ chuyển đổi từ cold contact sang deal thường dưới 5%. Nghĩa là trên 95% cuộc gọi hoặc email bạn gửi đi sẽ không nhận được phản hồi tích cực - hoặc bị từ chối thẳng. Nếu mỗi lần bị từ chối bạn mất vài ngày mới lấy lại năng lượng, bạn sẽ không thể duy trì nhịp độ cần thiết.`,
      `Nhưng nếu từ chối không ảnh hưởng nhiều đến bạn - hoặc thậm chí bạn coi đó là một phần bình thường của công việc - bạn đang có một lợi thế lớn mà không phải ai cũng có.`,
      `Câu hỏi này không chỉ liên quan đến sales. Fundraising, partnership, recruiting - bất kỳ công việc nào đòi hỏi bạn chủ động tiếp cận người khác và chấp nhận nhiều lần "không" đều cần năng lực tâm lý này.`,
    ],
    example: `Anh Khoa làm BDR tại một startup SaaS - công việc chính là cold call và cold email. Tuần đầu tiên, anh gọi 80 cuộc, bị từ chối 74 cuộc. Anh về nhà và không ngủ được. Nhưng thay vì bỏ cuộc, anh quyết định thay đổi cách nhìn: mỗi lần từ chối là một bước gần hơn đến người sẽ nói "có". Sau 3 tháng, từ chối không còn ảnh hưởng gì đến anh nữa - anh chỉ xem nó là dữ liệu. Cuối năm đầu tiên, anh là top performer của team.`,
    hints: [
      "A - Chịu được từ chối: Môi trường tiếp xúc nhiều người lạ, tỷ lệ thành công thấp là bình thường (VD: sales, business development, fundraising, partnership, recruiting,...)",
      "B - Khó chịu được: Môi trường ít đối mặt với rejection trực tiếp, làm việc với hệ thống hoặc team đã quen (VD: research, engineering, finance, content, product,...)",
    ],
  },
  {
    n: 8, part: 1,
    title: "Bạn dễ chán khi mọi thứ lặp lại?",
    a: { label: "Chịu được lặp lại", desc: "Tìm thấy ý nghĩa trong việc tối ưu và cải thiện thứ đã có" },
    b: { label: "Cần đổi mới liên tục", desc: "Mất động lực nhanh nếu không có gì mới để học hay thử" },
    verify: [
      "Nếu phải làm cùng một loại task trong 3 tuần liên tiếp, bạn cảm thấy thế nào vào tuần thứ 3: bực bội và muốn thoát hay quen và làm nhanh hơn?",
      "Điều gì giúp ngày làm việc của bạn có ý nghĩa: làm được thứ mới hay làm một thứ quen ngày càng tốt hơn?",
      "Bạn tìm thấy niềm vui trong việc tối ưu và cải thiện, hay trong việc khám phá và thử nghiệm?",
    ],
    meaning: [
      `Câu hỏi này thường bị diễn giải là "bạn có kiên nhẫn không?". Nhưng thực ra nó hỏi thứ khác: trong công việc, bạn tìm thấy ý nghĩa ở đâu?`,
      `Công việc vận hành (operations) thường có tính lặp lại cao theo chu kỳ - tuần này làm giống tuần trước, tháng này làm giống tháng trước. Nhưng chính sự lặp lại đó tạo ra dữ liệu để tối ưu, tạo ra hệ thống để scale, tạo ra sự ổn định cho cả tổ chức. Người phù hợp với ops không thấy "nhàm" - họ thấy thỏa mãn khi hệ thống chạy trơn tru hơn từng ngày.`,
      `Ngược lại, người cần sự mới mẻ để duy trì động lực sẽ nhanh chóng cảm thấy mất ý nghĩa trong công việc lặp lại. Với họ, "học thêm được gì" quan trọng hơn "làm tốt hơn thứ đã biết".`,
      `Không có kiểu nào tốt hơn. Thị trường cần cả hai. Vấn đề chỉ xảy ra khi bạn đặt mình sai vị trí.`,
    ],
    example: `Chị Ngọc làm operations cho một chuỗi F&B 20 chi nhánh. Công việc lặp lại theo chu kỳ tuần: kiểm kê, báo cáo, xử lý sự cố, họp team. Nhiều người ngoài nhìn vào nghĩ "chán thật". Nhưng với Ngọc, mỗi tuần là một lần đo xem hệ thống đang chạy tốt hơn hay kém hơn. Sau 2 năm, cô được thăng lên Operations Manager. Đồng nghiệp của cô - người thích sáng tạo - nghỉ sau 3 tháng vì "quá nhàm". Không ai sai, chỉ là hai người cần hai loại công việc khác nhau.`,
    hints: [
      "A - Chịu được lặp lại: Môi trường tập trung tối ưu quy trình, ổn định là chuẩn mực (VD: operations, finance, QA, customer support, compliance, admin,...)",
      "B - Cần đổi mới: Môi trường luôn có dự án mới, không gian thử nghiệm rộng (VD: creative, strategy, product development, growth, business development,...)",
    ],
  },
  {
    n: 9, part: 1,
    title: "Bạn thích làm sâu 1 thứ hay biết nhiều thứ?",
    a: { label: "Đi sâu (Specialist)", desc: "Đào sâu một lĩnh vực, trở thành người không thể thiếu" },
    b: { label: "Đi rộng (Generalist)", desc: "Kết nối nhiều mảng, nhìn thấy bức tranh toàn cảnh" },
    verify: [
      "Nếu được chọn: học một thứ cực kỳ sâu trong 1 năm, hay học 5 thứ ở mức khá - bạn chọn gì và tại sao?",
      "Bạn thấy hứng hơn khi chuyên sâu vào một vấn đề cụ thể, hay khi cần nhìn toàn bức tranh và kết nối nhiều mảng?",
      "Nhìn vào người bạn ngưỡng mộ nhất trong sự nghiệp - họ là specialist hay generalist?",
    ],
    meaning: [
      `Thị trường lao động chia rất rõ hai hướng phát triển: specialist (chuyên gia sâu) và generalist (người tổng hợp). Cả hai đều có giá trị - nhưng cần được nuôi dưỡng ở những môi trường khác nhau, bằng những lựa chọn khác nhau.`,
      `Specialist dành nhiều năm để đào sâu vào một lĩnh vực hẹp. Họ trở thành người "go-to" trong tổ chức khi cần chuyên môn cụ thể. Đổi lại, đường phát triển của họ phụ thuộc nhiều vào giá trị của chuyên môn đó theo thời gian.`,
      `Generalist kết nối nhiều mảng với nhau, nhìn thấy bức tranh toàn cảnh, và tạo ra giá trị ở giao điểm giữa các chuyên môn. Họ thường phù hợp với vai trò lãnh đạo, product, hoặc founder. Đổi lại, họ ít có đòn bẩy chuyên môn sâu ở giai đoạn đầu.`,
      `Câu hỏi không phải "cái nào tốt hơn" mà là "cái nào phù hợp với cách bạn tìm thấy ý nghĩa trong công việc - và cái nào bạn sẵn sàng đầu tư thời gian để build".`,
    ],
    example: `Anh Bảo và chị Trang cùng ra trường năm 2020. Bảo chọn đi sâu vào data engineering - 3 năm chỉ làm về data pipeline, SQL optimization và cloud architecture. Năm 4, anh được các công ty fintech săn đón với mức lương cao gấp đôi nhiều bạn đồng trang lứa. Trang chọn làm generalist - 3 năm đầu ở startup làm đủ thứ từ marketing đến product đến operations. Năm 4, cô được nhận vào vị trí Chief of Staff với quyền tiếp cận CEO trực tiếp. Hai con đường khác nhau, cả hai đều thành công - vì họ đã chọn đúng với cách mình muốn phát triển.`,
    hints: [
      "A - Đi sâu: Môi trường cho phép tập trung lâu dài vào một chuyên môn (VD: data science, engineering, design, finance specialist, legal, tax,...)",
      "B - Đi rộng: Môi trường cần kết nối nhiều mảng, nhìn toàn bức tranh (VD: product management, consulting, chief of staff, general management, startup founder,...)",
    ],
  },
  {
    n: 10, part: 1,
    title: "Bạn cần người hướng dẫn hay tự mò tốt?",
    a: { label: "Cần hướng dẫn", desc: "Phát triển tốt nhất với mentor, quy trình và onboarding rõ ràng" },
    b: { label: "Tự mò tốt", desc: "Phát triển tốt nhất khi tự tìm cách giải quyết vấn đề" },
    verify: [
      "Khi gặp task hoàn toàn mới mà không ai chỉ, bạn cảm thấy thế nào: hứng khởi vì thử thách hay lo lắng vì không biết bắt đầu từ đâu?",
      "Nghĩ về thời điểm bạn học được nhiều nhất - ai đó hướng dẫn bạn hay bạn tự mày mò?",
      "Bạn muốn sếp là người chỉ bảo chi tiết, hay người đặt mục tiêu và để bạn tự tìm cách?",
    ],
    meaning: [
      `Đây không phải câu hỏi về sự phụ thuộc hay độc lập - đây là câu hỏi về môi trường học nào giúp bạn phát triển nhanh nhất. Và nếu biết câu trả lời, bạn có thể chọn đúng nơi để bắt đầu thay vì mất 1-2 năm đầu loay hoay.`,
      `Corporate và MNC lớn thường có hệ thống đào tạo bài bản: onboarding có mentor đi kèm, training program rõ ràng, buddy system, và lộ trình phát triển được thiết kế sẵn. Nếu bạn cần được hướng dẫn để làm tốt, đây là môi trường lý tưởng để bắt đầu.`,
      `Startup và early-stage company thường không có thời gian để hand-hold. Bạn được kỳ vọng tự tìm cách giải quyết vấn đề, tự học những gì cần thiết, và chịu được cảm giác không chắc chắn. Nếu bạn giỏi tự mò, đây là môi trường bạn sẽ phát triển vượt bậc.`,
      `Sai lầm phổ biến là chọn startup vì "nghe hay" nhưng thực ra cần được hướng dẫn - hoặc chọn corporate vì "an toàn" nhưng thực ra thích tự mò và bị bóp nghẹt bởi quy trình.`,
    ],
    example: `Chị Thảo tốt nghiệp loại giỏi, tự tin vào một startup early-stage vì muốn "học nhanh". Nhưng startup không có người hướng dẫn, không có quy trình, mỗi tuần ưu tiên thay đổi. Sau 6 tháng, cô chưa biết mình đang phát triển về đâu. Khi chuyển sang một corporate có đào tạo bài bản và mentor đi kèm trong 6 tháng đầu, cô phát triển vượt bậc - trong năm đầu tiên đã được giao lead một dự án nhỏ. Không phải cô kém trong startup - cô chỉ cần cấu trúc để học tốt nhất.`,
    hints: [
      "A - Cần hướng dẫn: Môi trường có structured onboarding, mentor, training bài bản (VD: corporate lớn, MNC, consulting firm, ngân hàng có rotation program,...)",
      "B - Tự mò tốt: Môi trường ít hand-holding, tự tìm cách giải quyết là chuẩn mực (VD: startup, agency, freelance, early-stage company,...)",
    ],
  },

  // ───────────── PHẦN 2: GIÁ TRỊ ─────────────
  {
    n: 11, part: 2,
    title: "Bạn muốn kiếm tiền nhanh hay xây nền tảng lâu dài?",
    a: { label: "Kiếm tiền nhanh", desc: "Chấp nhận biến động cao đổi lấy thu nhập sớm" },
    b: { label: "Xây nền tảng", desc: "Chấp nhận chậm đổi lấy kỹ năng và network bền vững" },
    verify: [
      "Trong 3 năm tới, điều nào sẽ khiến bạn hối hận hơn: kiếm ít tiền hơn mong đợi hay chậm xây được kỹ năng và network?",
      "Bạn cảm thấy thế nào khi thu nhập tháng này cao hơn 50% nhưng tháng sau lại giảm 30%?",
      "Bạn đang ở giai đoạn nào của cuộc sống - có thể chịu được rủi ro tài chính hay cần sự ổn định?",
    ],
    meaning: [
      `Đây là một trong những trade-off rõ ràng nhất trong career - và sai lầm phổ biến nhất là cố gắng có cả hai cùng lúc ngay từ đầu.`,
      `Những con đường kiếm tiền nhanh - sales với hoa hồng cao, trading, startup với equity, freelance cao cấp - thường đi kèm với áp lực cao, thu nhập biến động, và rủi ro lớn. Nếu bạn chịu được môi trường đó và cần kết quả tài chính sớm, đây là lựa chọn hợp lý.`,
      `Những con đường xây nền tảng - corporate bài bản, consulting, banking, product management - thường bắt đầu với lương không quá cao, nhưng giúp bạn tích lũy kỹ năng, network, và reputation theo thời gian. Lợi thế tích lũy này thường bùng nổ vào năm thứ 3-5.`,
      `Sai lầm không phải là chọn con đường nào - sai lầm là chọn một con đường nhưng kỳ vọng kết quả của con đường kia: chọn môi trường ổn định nhưng so sánh thu nhập với người làm sales, hoặc chọn sales nhưng kỳ vọng sự an toàn của corporate.`,
    ],
    example: `Anh Hùng và chị Lan ra trường cùng năm. Hùng chọn sales tại một startup với OTE hấp dẫn - năm đầu kiếm khá, nhưng năm hai thị trường khó, anh liên tục miss target và burn out. Lan chọn vào một công ty FMCG lớn với lương khởi điểm thấp hơn. Ba năm sau, cô có portfolio mạnh, network trong ngành, và nhận được offer từ một startup với mức lương gấp đôi Hùng. Cả hai đều không sai - chỉ là đã chọn đúng với bản thân hay chưa.`,
    hints: [
      "A - Kiếm nhanh: Môi trường thu nhập biến đổi theo kết quả, tốc độ cao (VD: sales commission, startup với equity, trading, freelance cao cấp,...)",
      "B - Xây nền tảng: Môi trường lương ổn định, đầu tư dài hạn vào kỹ năng và network (VD: corporate, consulting, ngân hàng, product management,...)",
    ],
  },
  {
    n: 12, part: 2,
    title: "Bạn thích tạo ra thứ hữu hình hay vô hình?",
    a: { label: "Hữu hình", desc: "Sau mỗi ngày thấy được output cụ thể - code, bài viết, sản phẩm" },
    b: { label: "Vô hình", desc: "Tạo ra giá trị qua hệ thống, văn hóa, quan hệ và chiến lược" },
    verify: [
      `Nhìn lại tuần vừa rồi, bạn thấy mình đã "tạo ra" thứ gì? Cảm giác đó có đủ để ngày làm việc có ý nghĩa không?`,
      "Bạn cần thấy thành quả ngay trong ngày/tuần, hay thoải mái với việc kết quả chỉ hiện ra sau nhiều tháng?",
      "Công việc nào trong quá khứ cho bạn cảm giác thỏa mãn nhất - nó tạo ra thứ hữu hình hay vô hình?",
    ],
    meaning: [
      `Một trong những lý do người ta mất động lực trong công việc là cảm giác "không thấy mình đã làm được gì". Hiểu được bạn cần thấy output theo dạng nào là chìa khóa để chọn đúng công việc.`,
      `Thứ hữu hình: sau mỗi ngày, bạn thấy được - một sản phẩm, một đoạn code, một thiết kế, một bài viết, một campaign đã launch. Bạn có thể chỉ vào và nói "tôi đã làm ra cái này". Nếu bạn cần cảm giác đó để có động lực, hãy tìm công việc tạo ra output cụ thể.`,
      `Thứ vô hình: kết quả đến chậm và gián tiếp. Một HR director xây dựng văn hóa công ty, một chiến lược gia thiết kế hướng đi 5 năm, một investor giúp startup phát triển - những thứ này không có hình dạng cụ thể, nhưng tác động có thể rất lớn. Nếu bạn tìm thấy ý nghĩa trong những điều này, bạn phù hợp với công việc có output vô hình.`,
      `Không có cái nào quan trọng hơn - chỉ có cái phù hợp hơn với cách bạn cảm nhận giá trị công việc của mình.`,
    ],
    example: `Chị Lan làm HR tại một công ty tech - công việc của cô không tạo ra sản phẩm nào có thể cầm tay được. Sau 2 năm, cô thấy mình thiếu cảm giác "đã làm được gì". Khi tìm hiểu thêm về bản thân, cô nhận ra mình cần thấy output cụ thể. Cô chuyển sang content marketing - vẫn làm về con người và câu chuyện, nhưng mỗi bài viết là một thứ cô tạo ra và thấy được. Động lực của cô tăng lên rõ rệt.`,
    hints: [
      "A - Hữu hình: Môi trường có output rõ ràng sau mỗi task (VD: developer, designer, content creator, product, manufacturing, marketing campaigns,...)",
      "B - Vô hình: Môi trường tạo giá trị qua hệ thống, văn hóa, quan hệ (VD: HR, strategy, consulting, investor, policy, leadership coaching,...)",
    ],
  },
  {
    n: 13, part: 2,
    title: "Bạn muốn impact ở quy mô cá nhân hay hệ thống?",
    a: { label: "Impact cá nhân", desc: "Thay đổi cuộc đời từng người, thấy kết quả ngay trước mắt" },
    b: { label: "Impact hệ thống", desc: "Xây hệ thống ảnh hưởng nhiều người dù không biết tên họ" },
    verify: [
      "Bạn thỏa mãn hơn khi: nhìn thấy một người thay đổi rõ rệt nhờ mình, hay biết hệ thống mình xây đang phục vụ hàng nghìn người?",
      "Trong công việc lý tưởng, bạn muốn biết tên những người mình đã giúp, hay ổn với tác động ở quy mô lớn nhưng ẩn danh?",
      "Khi giúp được ai đó, phần nào quan trọng hơn: cuộc trò chuyện trực tiếp hay kết quả đo lường được về sau?",
    ],
    meaning: [
      `Khi ai đó nói "tôi muốn tạo ra impact", điều đó thực sự có nghĩa là gì? Đây là câu hỏi quan trọng - vì impact có nhiều dạng, và mỗi dạng dẫn đến con đường hoàn toàn khác nhau.`,
      `Impact cá nhân: bạn thay đổi cuộc đời hoặc hành trình của từng người một. Giáo viên thay đổi cách học sinh nghĩ. HR manager giúp nhân viên phát triển. Coach giúp người trước mặt vượt qua điểm kẹt của họ. Bạn thấy sự thay đổi ngay trước mắt, biết tên từng người bạn đã giúp.`,
      `Impact hệ thống: bạn xây cơ sở hạ tầng ảnh hưởng đến hàng nghìn, thậm chí hàng triệu người - nhưng thường không biết tên họ. Product manager xây tính năng ảnh hưởng 1 triệu user. Kỹ sư xây hệ thống giúp vận hành cả thành phố.`,
      `Cả hai đều quan trọng, cả hai đều cần. Nhưng kỹ năng, công cụ và cách tiếp cận của hai hướng này rất khác nhau. Không biết mình muốn impact theo hướng nào, bạn sẽ dễ bị cuốn theo xu hướng và mất phương hướng.`,
    ],
    example: `Anh Nam và chị Thu đều muốn "giúp đỡ người khác phát triển". Nhưng Nam chọn trở thành L&D Manager - làm việc trực tiếp với từng nhân viên, nhìn thấy họ thay đổi sau từng buổi training. Thu chọn trở thành Product Manager tại một edtech - xây platform giúp hàng triệu học sinh học tốt hơn mà không cần gặp trực tiếp ai. Cả hai đều đang tạo ra impact trong giáo dục - chỉ là ở những quy mô và cách thức hoàn toàn khác nhau. Và cả hai đều rất thỏa mãn với công việc của mình.`,
    hints: [
      "A - Cá nhân: Môi trường làm việc trực tiếp với từng người, thấy sự thay đổi cụ thể (VD: HR, giáo dục, coaching, tư vấn 1-1, social work, recruiting,...)",
      "B - Hệ thống: Môi trường xây sản phẩm/quy trình ảnh hưởng nhiều người cùng lúc (VD: product, engineering, operations, policy, entrepreneur,...)",
    ],
  },
  {
    n: 14, part: 2,
    title: "Bạn thích giải quyết vấn đề rõ hay mơ hồ?",
    a: { label: "Vấn đề rõ ràng", desc: "Có input, output, và quy trình từ A đến B" },
    b: { label: "Vấn đề mơ hồ", desc: "Không có câu trả lời sẵn, phải tự tìm đường đi" },
    verify: [
      "Bạn thích nhận task với yêu cầu chi tiết và tiêu chí rõ, hay task chỉ có mục tiêu và tự quyết cách làm?",
      "Khi gặp vấn đề không có câu trả lời rõ ràng, bạn cảm thấy hứng khởi với thách thức hay lo lắng vì không có ground truth?",
      "Lần gần nhất phải tự tìm hướng mà không ai chỉ - bạn thấy đó là cơ hội hay gánh nặng?",
    ],
    meaning: [
      `Không phải tất cả vấn đề đều giống nhau. Có vấn đề rõ ràng - bạn biết input là gì, output cần gì, và quy trình để đi từ A đến B. Có vấn đề mơ hồ - câu hỏi chưa được đặt đúng, không có câu trả lời sẵn, và bạn phải tự tìm đường.`,
      `Người giỏi với vấn đề rõ thường xuất sắc trong thực thi - họ làm việc nhanh, chính xác, và hiệu quả khi biết rõ mình cần làm gì. Trong môi trường cần execution tốt như finance, operations, engineering - họ là những người không thể thiếu.`,
      `Người giỏi với vấn đề mơ hồ có khả năng chịu đựng sự bất định, tìm ra framework trong hỗn độn, và ra quyết định khi thiếu thông tin. Trong môi trường cần tư duy chiến lược như strategy, consulting, product 0-to-1, startup - họ thực sự tỏa sáng.`,
      `Sai lầm là đặt người thích rõ ràng vào vị trí đòi hỏi tư duy mơ hồ - hoặc ngược lại. Cả hai đều sẽ stress và không phát huy được tốt nhất.`,
    ],
    example: `Anh Dũng làm business analyst xuất sắc - khi có data và framework, anh ra kết quả rất tốt. Khi được thăng lên strategy role với câu hỏi mở như "chúng ta nên vào thị trường mới nào?", anh stress liên tục vì "không biết mình đang làm đúng không". Không phải anh thiếu năng lực - anh giỏi nhất ở vấn đề có cấu trúc. Khi nhận ra điều này, anh không xem đó là điểm yếu nữa mà tìm cách làm tốt hơn trong vai trò BA, đồng thời học thêm framework để xử lý sự mơ hồ dần dần.`,
    hints: [
      "A - Rõ ràng: Môi trường có input/output xác định, quy trình chuẩn, kỳ vọng minh bạch (VD: finance, operations, QA, developer, data analyst,...)",
      "B - Mơ hồ: Môi trường không có câu trả lời sẵn, cần tự tìm hướng (VD: strategy, consulting, product 0-to-1, entrepreneur, research,...)",
    ],
  },
  {
    n: 15, part: 2,
    title: "Bạn muốn được ghi nhận bằng kết quả hay quá trình?",
    a: { label: "Ghi nhận kết quả", desc: "Con số nói lên tất cả, thành tích cuối kỳ là thước đo" },
    b: { label: "Ghi nhận quá trình", desc: "Nỗ lực, thái độ và cách làm việc cũng được trân trọng" },
    verify: [
      "Bạn thấy frustrated hơn khi nào: làm rất tốt nhưng kết quả cuối không đẹp, hay kết quả tốt nhưng không ai thấy nỗ lực của bạn?",
      "Nếu tháng này bạn làm hết mình nhưng không ra số vì lý do khách quan, bạn muốn sếp đánh giá bạn ra sao?",
      `Loại feedback nào có ý nghĩa hơn: "tháng này đạt 120% target" hay "tôi thấy bạn đã xử lý rất tốt tình huống khó tuần vừa rồi"?`,
    ],
    meaning: [
      `Mỗi môi trường làm việc có một "ngôn ngữ ghi nhận" khác nhau - và nếu ngôn ngữ đó không khớp với cách bạn muốn được đánh giá, bạn sẽ liên tục cảm thấy "không được nhìn nhận xứng đáng", dù thực ra bạn đang làm tốt.`,
      `Môi trường đo bằng kết quả: tháng này bạn chốt được bao nhiêu deal, campaign mang về bao nhiêu lead, số liệu tăng hay giảm. Không ai quan tâm bạn đã cố gắng thế nào nếu kết quả không đến. Sales và performance-based roles thuộc nhóm này - rất công bằng nếu bạn thực sự giỏi deliver, nhưng rất phũ nếu bạn cần được công nhận nỗ lực.`,
      `Môi trường ghi nhận cả quá trình: sếp nhìn vào cách bạn làm việc, thái độ, sự cố gắng, cách bạn xử lý khó khăn. HR, giáo dục, customer success thường thuộc nhóm này.`,
      `Biết mình cần loại ghi nhận nào giúp bạn chọn đúng môi trường - và tránh những tình huống bạn làm rất tốt nhưng vẫn thấy hụt hẫng vì sai hệ đo lường.`,
    ],
    example: `Chị Châu làm sales và rất chăm chỉ - gọi đủ số cuộc, follow-up đúng quy trình, làm tất cả những gì được dạy. Nhưng tháng nào cũng miss target vì thị trường khó. Cô cảm thấy "không được ghi nhận" dù đã cố hết sức. Sau khi chuyển sang customer success - công việc đánh giá cả chất lượng hỗ trợ và sự hài lòng của khách - cô tìm lại được động lực. Nỗ lực của cô được nhìn thấy và ghi nhận, không chỉ qua con số.`,
    hints: [
      "A - Kết quả: Môi trường đo bằng số rõ ràng, thành tích cuối kỳ (VD: sales, trading, performance marketing, growth roles,...)",
      "B - Quá trình: Môi trường đánh giá thái độ, nỗ lực và cách làm việc (VD: HR, education, customer success, operations, research,...)",
    ],
  },
  {
    n: 16, part: 2,
    title: "Bạn thích cạnh tranh hay hợp tác?",
    a: { label: "Thích cạnh tranh", desc: "Được kích thích khi cần nổi bật và vượt trội hơn người khác" },
    b: { label: "Thích hợp tác", desc: "Tìm thấy ý nghĩa khi nâng cả team lên cùng nhau" },
    verify: [
      "Khi thấy đồng nghiệp được khen hoặc làm tốt hơn bạn, phản ứng đầu tiên là gì: muốn vượt qua họ hay muốn học từ họ?",
      "Bạn thoải mái hơn khi ai cũng biết ranking của nhau, hay khi kết quả cá nhân được giữ riêng tư?",
      "Thành tích nào bạn tự hào hơn: thứ bạn đạt được một mình hay thứ cả team đạt được nhờ đóng góp của bạn?",
    ],
    meaning: [
      `Đây không phải câu hỏi về tính cách - đây là câu hỏi về "game" bạn muốn chơi trong môi trường làm việc.`,
      `Môi trường cạnh tranh: bạn được đánh giá so với đồng nghiệp. Ranking, stack ranking, top performer, promotion dựa trên việc ai nổi bật nhất. Môi trường này tạo ra áp lực liên tục để phát triển và vượt trội. Nếu bạn thích được kích thích bởi cạnh tranh, đây là nơi bạn tỏa sáng.`,
      `Môi trường hợp tác: kết quả chung quan trọng hơn thành tích cá nhân. Bạn được đánh giá bằng cách bạn đóng góp vào team, giúp người khác thành công, và tạo ra sự phối hợp. Nếu bạn tìm thấy ý nghĩa trong việc nâng cả team lên, đây là môi trường bạn phát triển tốt nhất.`,
      `Nhiều môi trường có cả hai - nhưng thường nghiêng về một phía. Vào sai: người thích hợp tác vào nơi cạnh tranh cao sẽ thấy mệt mỏi. Người thích cạnh tranh vào nơi quá "an toàn" sẽ chán và thiếu động lực.`,
    ],
    example: `Anh Hải gia nhập một consulting firm nơi mọi người cạnh tranh nhau để lên senior. Anh thấy mình không thoải mái khi phải "đánh bóng bản thân" liên tục và cảm giác đồng nghiệp là đối thủ. Khi chuyển sang một tổ chức NGO với văn hóa hợp tác cao, nơi mọi người cùng đẩy mục tiêu chung, anh không chỉ làm tốt hơn - anh còn được thăng chức nhanh hơn. Không phải vì NGO dễ hơn, mà vì anh đang chơi đúng "game" của mình.`,
    hints: [
      "A - Cạnh tranh: Môi trường đánh giá cá nhân rõ, thăng tiến dựa trên nổi bật (VD: investment banking, sales ranking, consulting, top tech companies,...)",
      "B - Hợp tác: Môi trường đề cao đóng góp tập thể, teamwork là chuẩn mực (VD: NGO, education, product team, creative agency,...)",
    ],
  },
  {
    n: 17, part: 2,
    title: "Bạn có sẵn sàng làm việc ngoài giờ để đạt mục tiêu?",
    a: { label: "Sẵn sàng OT", desc: "Chấp nhận nhịp cao để đổi lấy tốc độ phát triển nhanh hơn" },
    b: { label: "Muốn cân bằng", desc: "Ưu tiên giờ giấc ổn định, có không gian cho những thứ khác" },
    verify: [
      "Nếu phải chọn: lương cao hơn 40% nhưng thường xuyên làm tối và cuối tuần, hay lương bình thường và ra về đúng giờ mỗi ngày?",
      "Ngoài công việc, bạn đang đầu tư thời gian cho điều gì? Điều đó ảnh hưởng thế nào đến lựa chọn môi trường?",
      "Nhìn lại 3-6 tháng gần nhất, nhịp làm việc nào khiến bạn cảm thấy tốt nhất: bận rộn và tiến nhanh hay đều đặn và có thời gian suy nghĩ?",
    ],
    meaning: [
      `"Work-life balance" là mục tiêu nhiều người hướng đến - nhưng trong thực tế, nó không phải mặc định của mọi công việc. Và mỗi giai đoạn sự nghiệp có mức độ đánh đổi khác nhau.`,
      `Startup, agency, sales, và growth roles ở giai đoạn đầu thường đòi hỏi nhiều hơn 40 giờ/tuần. Không phải vì công ty bóc lột - mà vì tốc độ phát triển nhanh đòi hỏi input lớn. Nếu bạn chấp nhận điều này và muốn học nhanh, đây là môi trường bạn sẽ có ROI cao nhất cho thời gian bỏ ra.`,
      `Corporate, NGO, government, và một số MNC thường có giờ giấc rõ ràng và ít kỳ vọng làm ngoài giờ hơn. Tốc độ phát triển chậm hơn, nhưng bạn có không gian cho những thứ khác trong cuộc sống.`,
      `Sai lầm phổ biến là chọn môi trường tốc độ cao vì lý do sai - vì "nghe hay", vì bạn bè vào, vì muốn "học nhanh" nhưng thực ra không sẵn sàng cho nhịp độ đó. Kết quả là burnout sau 6 tháng và mất niềm tin vào khả năng của mình.`,
    ],
    example: `Chị Trúc muốn vào startup vì nghe nói "học được nhiều thứ". Sau 3 tháng, cô liên tục phàn nàn về giờ giấc không cố định và cảm thấy bị "bóc lột". Bạn cùng lớp vào một MNC - tăng lương chậm hơn nhưng ra về đúng 6 giờ mỗi ngày, cuối tuần không ai nhắn. Hai năm sau, cả hai đều ổn - chỉ vì đã chọn đúng với kỳ vọng thật của mình, không phải kỳ vọng họ nghĩ mình nên có.`,
    hints: [
      "A - Sẵn sàng OT: Môi trường tốc độ cao, đánh giá bằng kết quả dù ngoài giờ (VD: startup, sales, investment banking, agency, entrepreneur,...)",
      "B - Muốn cân bằng: Môi trường giờ giấc ổn định, ít kỳ vọng làm thêm (VD: corporate, government, NGO, education, một số MNC,...)",
    ],
  },
  {
    n: 18, part: 2,
    title: "Bạn thích tối ưu hay tạo mới?",
    a: { label: "Thích tạo mới", desc: "Hứng khởi nhất khi đối mặt với trang trắng và cơ hội mới" },
    b: { label: "Thích tối ưu", desc: "Hứng khởi nhất khi có hệ thống để cải thiện và scale" },
    verify: [
      "Bạn hứng khởi hơn khi: được thử thứ hoàn toàn mới chưa ai làm, hay được cải thiện thứ đang có để tốt hơn đáng kể?",
      `Khi nhìn vào một hệ thống, điều đầu tiên bạn nghĩ: "mình có thể làm khác không?" hay "mình có thể làm hiệu quả hơn không?"`,
      "Công việc nào bạn làm tốt nhất trong quá khứ - nó đòi hỏi bạn tạo ra thứ mới hay tối ưu thứ đã có?",
    ],
    meaning: [
      `Đây là hai trạng thái tư duy hoàn toàn khác nhau - và hiếm có người giỏi cả hai ở cùng một mức độ.`,
      `Người thích tạo mới hứng khởi nhất khi đối mặt với trang trắng. Họ giỏi nhìn thấy cơ hội, thiết kế thứ chưa có, và kéo mọi người vào một hướng mới. Nhưng khi được giao nhiệm vụ "cải thiện thứ đang chạy được", họ thường mất hứng vì "không có gì thú vị".`,
      `Người thích tối ưu hứng khởi nhất khi có hệ thống để cải thiện. Họ nhìn thấy điểm nghẽn, cơ hội giảm chi phí, chỗ có thể scale. Nhưng đưa cho họ một tờ giấy trắng và bảo "sáng tạo đi", họ thường không biết bắt đầu từ đâu.`,
      `Thị trường cần cả hai ở những vai trò khác nhau. Marketing, product 0-to-1, và startup cần người tạo mới. Operations, growth optimization, và finance cần người tối ưu. Nhầm vai trò - cả hai đều không phát huy được.`,
    ],
    example: `Anh Nam và anh Đức cùng team tại một startup. Nam làm growth hacker - liên tục thử nghiệm channel mới, idea mới. Đức làm ops - hàng ngày tối ưu quy trình để giảm chi phí vận hành. Một lần sếp hoán đổi công việc để "mở rộng kỹ năng". Cả hai đều thất bại rõ rệt trong vai trò của nhau. Không phải ai kém - họ chỉ có hai loại năng lực khác nhau, và cả hai đều cần thiết cho công ty.`,
    hints: [
      "A - Tạo mới: Môi trường liên tục thử nghiệm, không có script sẵn (VD: creative agency, product 0-to-1, marketing, R&D, entrepreneur,...)",
      "B - Tối ưu: Môi trường cải thiện hệ thống hiện có, đo lường rõ ràng (VD: operations, finance, data, growth optimization, engineering,...)",
    ],
  },
  {
    n: 19, part: 2,
    title: "Bạn muốn kỹ năng của mình dễ thay thế hay khó thay thế?",
    a: { label: "Khó thay thế", desc: "Đầu tư thời gian dài để build chuyên môn sâu và đòn bẩy cao" },
    b: { label: "Linh hoạt, dễ vào", desc: "Học kỹ năng phổ thông, bắt đầu nhanh và có nhiều lựa chọn" },
    verify: [
      "Kỹ năng chính bạn đang phát triển - có bao nhiêu người cùng cấp đang học điều tương tự? Điều đó nói lên gì về đòn bẩy của bạn?",
      "Bạn có kế hoạch gì để trong 2-3 năm tới, trở thành người khó tìm được ai thay thế?",
      "Bạn sẵn sàng tập trung vào một mảng hẹp trong 2 năm để trở thành chuyên gia, hay muốn duy trì sự linh hoạt bằng cách học rộng?",
    ],
    meaning: [
      `Đây là câu hỏi về chiến lược phát triển bản thân - và câu trả lời của bạn sẽ định hình toàn bộ cách bạn đầu tư thời gian trong những năm đầu.`,
      `Kỹ năng phổ biến - digital marketing cơ bản, Excel, kỹ năng giao tiếp chung - giúp bạn dễ vào nghề, dễ ứng tuyển nhiều vị trí. Nhưng bạn cũng đang cạnh tranh với hàng nghìn người giống bạn. Đòn bẩy thấp, lương tăng chậm.`,
      `Kỹ năng chuyên sâu và khó copy - deep domain expertise, kỹ thuật phức tạp, network độc đáo - mất nhiều thời gian để build. Nhưng một khi đạt được, bạn có đòn bẩy lớn trong thị trường lao động. Người muốn thuê bạn phải trả giá cao hơn vì không ai dễ dàng thay thế bạn.`,
      `Không có đường tắt. Muốn khó thay thế phải trả bằng sự tập trung và thời gian dài. Câu hỏi là: bạn có sẵn sàng không?`,
    ],
    example: `Chị Yến ra trường học digital marketing phổ thông - 6 tháng sau, cô cạnh tranh với hàng trăm người có cùng CV tương tự. Được offer lương thấp, cô phải chọn giữa nhận hay chờ. Cô quyết định đi sâu vào SEO technical - một mảng ít người chịu học vì phức tạp. Hai năm sau, cô là một trong số ít người thật sự hiểu cả technical SEO lẫn content strategy. Cô không cần tìm việc - việc tìm đến cô. Lương tăng 3 lần so với khi ra trường.`,
    hints: [
      "A - Khó thay thế: Chọn con đường chuyên sâu, chấp nhận đầu tư thời gian dài (VD: ML engineer, tax specialist, UX researcher, data scientist, legal expert,...)",
      "B - Linh hoạt: Bắt đầu bằng kỹ năng phổ thông để vào nghề nhanh, nhưng cần kế hoạch differentiation rõ ràng về sau.",
    ],
  },
  {
    n: 20, part: 2,
    title: "Bạn muốn làm việc gắn với đam mê hay thị trường?",
    a: { label: "Theo đam mê", desc: "Ưu tiên làm thứ mình thực sự hứng thú và có ý nghĩa" },
    b: { label: "Theo thị trường", desc: "Ưu tiên làm thứ thị trường đang cần và trả tiền cao" },
    verify: [
      "Bạn có những gì thực sự hứng thú - không phải vì ai bảo, mà vì tự nhiên bạn dành thời gian cho nó? Viết ra 3-5 thứ.",
      "Trong những thứ đó, thứ nào đã có người trả tiền cho nó dưới bất kỳ hình thức nào?",
      "Nếu làm việc trong ngành bạn không hứng thú nhưng lương rất cao, bạn nghĩ mình sẽ cảm thấy thế nào sau 3 năm?",
    ],
    meaning: [
      `Đây là câu hỏi mà nhiều bạn trẻ bị mắc kẹt lâu nhất. Và thường, vấn đề không phải là chọn đam mê hay thị trường - mà là không biết cách kết nối cả hai.`,
      `Đam mê mà không xác thực thị trường (có người trả tiền) chỉ là sở thích. Bạn có thể thích viết, thích dạy học, thích chơi nhạc - nhưng nếu không có ai sẵn sàng trả tiền cho phiên bản cụ thể của đam mê đó, bạn sẽ khó sống bằng nghề.`,
      `Thị trường mà không có hứng thú là công việc kiếm sống. Bạn có thể vào ngành hot, học kỹ năng được trả lương cao - nhưng nếu không có bất kỳ điểm kết nối nào với những gì bạn quan tâm, bạn sẽ dễ dàng bỏ cuộc khi gặp khó khăn đầu tiên.`,
      `Câu hỏi không nên là "tôi chọn đam mê hay thị trường". Câu hỏi đúng là: "Trong những thứ tôi thực sự hứng thú, thị trường đang cần phiên bản nào?" Đó là nơi bạn có thể đồng thời có động lực và cơ hội.`,
    ],
    example: `Chị Vân thích viết - cô viết blog cá nhân từ hồi đại học, viết vì thích chứ không vì ai yêu cầu. Nhưng cô không biết "thích viết" dẫn đến nghề gì. Sau khi tìm hiểu thị trường, cô nhận ra content marketing cho B2B tech đang thiếu người viết có thể kết hợp kỹ thuật và storytelling. Cô học thêm về SaaS và B2B sales, rồi xây portfolio theo hướng đó. Trong 1 năm, cô có 3 clients trả phí cao hơn nhiều mức lương cô từng được offer khi đi xin việc thông thường.`,
    hints: [
      `Không chọn một trong hai - tìm giao điểm: "Trong lĩnh vực tôi thích, thị trường đang cần phiên bản nào?"`,
      "(VD: thích viết - content B2B; thích dạy học - corporate L&D; thích phân tích - data analytics trong ngành bạn quan tâm,...)",
      "Đam mê cần được kiểm chứng bằng thị trường. Thị trường cần được cá nhân hóa bằng hứng thú. Đó là cách xây career bền nhất.",
    ],
  },

  // ───────────── PHẦN 3: MÔI TRƯỜNG ─────────────
  {
    n: 21, part: 3,
    title: "Bạn chịu được áp lực KPI không?",
    a: { label: "Chịu được KPI số", desc: "Thích sự minh bạch - con số cho bạn biết mình đang đứng ở đâu" },
    b: { label: "Không hợp KPI cứng", desc: "Cần hệ đo lường linh hoạt hơn, khó đo bằng số" },
    verify: [
      `Nếu sếp hỏi "tháng này bạn làm được gì?", bạn muốn trả lời bằng số liệu cụ thể hay bằng câu chuyện về đóng góp?`,
      "Bạn cảm thấy thế nào khi biết mình đang ở đâu so với target tháng này: có động lực hơn hay áp lực hơn?",
      "Khi không đạt target vì lý do ngoài tầm kiểm soát, bạn nghĩ hệ thống đánh giá bằng KPI là công bằng không?",
    ],
    meaning: [
      `KPI không phải công cụ tra tấn - đó chỉ là cách đo lường. Nhưng cách đo lường đó ảnh hưởng sâu sắc đến cảm giác bạn có ở nơi làm việc mỗi ngày.`,
      `Môi trường KPI rõ ràng có một ưu điểm lớn: bạn biết chính xác mình đang đứng ở đâu. Không cần đoán sếp đánh giá mình thế nào - con số nói hết. Đây là đặc điểm của sales, performance marketing, finance, và operations. Nếu bạn làm tốt và thích sự minh bạch, KPI là người bạn.`,
      `Môi trường không có KPI cứng thường có hệ đo lường mơ hồ hơn - đánh giá dựa trên impact khó định lượng, đóng góp cho team, chất lượng suy nghĩ. Nếu bạn làm tốt nhưng khó chứng minh bằng số, bạn cần tự định nghĩa được giá trị của mình.`,
      `Vấn đề xảy ra khi người không chịu được áp lực số lại vào môi trường KPI - hoặc người cần sự rõ ràng lại vào môi trường mơ hồ. Cả hai đều cảm thấy không được đánh giá công bằng.`,
    ],
    example: `Anh Khôi làm sales tại một công ty phần mềm - mỗi tháng biết chính xác mình cần chốt bao nhiêu deal, đang ở tháng thứ mấy của quota. Anh thích điều đó, không có gì mơ hồ. Đồng nghiệp cũ của anh, chị Minh, làm HR - không có KPI số, tự định nghĩa success. Minh thấy điều đó phù hợp với mình: cô không muốn bị đánh giá chỉ bằng con số vì công việc của cô phức tạp hơn thế. Cả hai đều đúng - chỉ là cần hai loại hệ đo lường khác nhau.`,
    hints: [
      "A - Chịu được KPI số: Môi trường đo bằng con số, thành tích rõ ràng (VD: sales, performance marketing, finance, operations, business development,...)",
      "B - Không hợp KPI cứng: Môi trường đánh giá qua impact khó định lượng (VD: HR, strategy, research, education, creative roles,...)",
    ],
  },
  {
    n: 22, part: 3,
    title: "Bạn thích môi trường rõ ràng hay linh hoạt?",
    a: { label: "Rõ ràng", desc: "JD chi tiết, quy trình có sẵn, kỳ vọng được viết ra rõ ràng" },
    b: { label: "Linh hoạt", desc: "Role fluid, tự định nghĩa scope, thử và sai nhiều" },
    verify: [
      "Khi nhận dự án mới, bạn thích nhận brief chi tiết với tiêu chí rõ, hay chỉ cần biết mục tiêu và tự xác định cách làm?",
      "Bạn cảm thấy thế nào khi scope công việc thay đổi giữa chừng: bực bội vì mất kế hoạch hay thoải mái vì thích nghi?",
      `Hỏi thật: bạn nói muốn linh hoạt vì thực sự làm tốt trong đó, hay vì nó nghe "progressive" hơn?`,
    ],
    meaning: [
      `Sự rõ ràng và sự linh hoạt không phải về việc bạn có năng lực hay không - chúng là hai điều kiện làm việc khác nhau, phù hợp với hai kiểu tư duy khác nhau.`,
      `Môi trường rõ ràng: JD chi tiết, quy trình có sẵn, kỳ vọng được viết ra, và bạn biết "làm đúng" trông như thế nào. Corporate, banking, và các tổ chức có quy trình tốt thường thuộc nhóm này. Nếu bạn làm tốt nhất khi biết rõ mình đang làm gì và được đánh giá thế nào, đây là môi trường cho bạn tự tin.`,
      `Môi trường linh hoạt: JD mô tả rộng, role có thể thay đổi theo nhu cầu, và bạn tự định nghĩa cách tạo giá trị. Startup và agency thường thuộc nhóm này. Nếu bạn thích tự tổ chức công việc theo cách riêng và không bị bó bởi quy trình cứng, đây là môi trường cho bạn phát triển.`,
      `Quan trọng: đây không phải về bạn muốn thế nào - mà về bạn thực sự làm tốt nhất trong điều kiện nào. Nhiều người nói muốn linh hoạt vì nghe "hay", nhưng thực ra cần rõ ràng để hoạt động hiệu quả.`,
    ],
    example: `Chị Nhi luôn nghĩ mình "thích môi trường linh hoạt, không muốn bị ràng buộc". Khi vào startup không có JD rõ, cô thấy mình liên tục lo lắng: "Mình có đang làm đúng không? Sếp có hài lòng không?" Sau khi tự nhìn lại, cô nhận ra: mình không ghét quy trình - mình cần biết kỳ vọng là gì để làm tốt. Khi chuyển sang corporate có SOP đầy đủ và review cycle rõ ràng, cô tự tin hơn hẳn và được đánh giá cao trong năm đầu.`,
    hints: [
      "A - Rõ ràng: Môi trường JD chi tiết, SOP đầy đủ, kỳ vọng minh bạch (VD: corporate lớn, MNC, government, ngân hàng, công ty có quy trình tốt,...)",
      "B - Linh hoạt: Môi trường role fluid, bạn tự định nghĩa scope (VD: startup, agency, freelance, early-stage company,...)",
    ],
  },
  {
    n: 23, part: 3,
    title: "Trong giai đoạn đầu career, bạn cần sếp là người mentor hay người quản lý?",
    a: { label: "Cần mentor", desc: "Sếp đầu tư vào sự phát triển, chia sẻ cách tư duy và sai lầm" },
    b: { label: "Ổn với người quản lý", desc: "Sếp giao việc rõ, đánh giá kết quả - bạn tự định hướng" },
    verify: [
      "Trong giai đoạn hiện tại, bạn cần học cách tư duy về công việc nhiều hơn, hay cần không gian để tự thực thi và học qua làm?",
      "Khi nhận offer, bạn có chủ động tìm hiểu phong cách quản lý của người sẽ là sếp không? Nếu không, tại sao?",
      "Nghĩ về người sếp hoặc thầy/cô đã ảnh hưởng tích cực nhất đến bạn - họ mentor hay quản lý bạn?",
    ],
    meaning: [
      `Giai đoạn 1-3 năm đầu career không chỉ là thời gian bạn học kỹ năng - đây là thời gian bạn học cách tư duy về công việc. Và người ảnh hưởng nhất đến cách tư duy đó thường là người sếp trực tiếp đầu tiên.`,
      `Sếp mentor là người đầu tư thật sự vào sự phát triển của bạn. Họ chia sẻ cách suy nghĩ, giải thích tại sao chứ không chỉ bảo làm gì, và tạo không gian để bạn thử và sai. Nếu bạn đang trong giai đoạn cần học cách nghĩ, một sếp mentor có thể rút ngắn hành trình của bạn vài năm.`,
      `Sếp quản lý là người giao việc rõ ràng và đánh giá kết quả. Họ không nhất thiết là sếp tệ - trong môi trường cần execution cao, đây là mô hình vận hành hiệu quả. Nhưng nếu bạn đang ở giai đoạn cần được hướng dẫn mà gặp sếp quản lý, bạn sẽ phát triển chậm hơn đáng kể.`,
      `Khi cân nhắc offer việc, đừng chỉ hỏi về mức lương và công việc - hãy tìm hiểu về người sẽ là sếp trực tiếp của bạn. Đó thường là yếu tố quan trọng nhất cho giai đoạn đầu.`,
    ],
    example: `Anh Trọng gia nhập một công ty tốt nhưng sếp trực tiếp rất bận - không có thời gian cho 1-1, ít khi chia sẻ context, chỉ giao việc và check kết quả. Sau 1 năm, Trọng không biết mình đang phát triển hay đứng yên. Khi chuyển sang một team nhỏ hơn với sếp có thói quen chia sẻ thinking process, Trọng học được nhiều hơn trong 3 tháng so với cả năm trước. Không phải công ty mới tốt hơn - mà người mentor phù hợp hơn với giai đoạn của anh.`,
    hints: [
      "A - Cần mentor: Môi trường có culture coaching rõ ràng, sếp đầu tư vào người trẻ (VD: consulting firm lớn, MNC có L&D bài bản, corporate với rotation program,...)",
      "B - Ổn với quản lý: Môi trường ít hand-holding, sếp giao việc và tin tưởng bạn tự tìm cách (VD: startup, team nhỏ, môi trường autonomy cao,...)",
    ],
  },
  {
    n: 24, part: 3,
    title: "Team nhỏ hay tổ chức lớn - bạn học tốt hơn ở đâu?",
    a: { label: "Team nhỏ", desc: "Đụng nhiều việc, học đa dạng, thấy impact nhanh" },
    b: { label: "Tổ chức lớn", desc: "Học sâu một mảng, có hệ thống và mentor tốt" },
    verify: [
      `Bạn muốn sau 1-2 năm đầu có thể nói gì: "Tôi đã trải qua nhiều mảng và hiểu cách công ty vận hành" hay "Tôi hiểu rất sâu về X"?`,
      "Khi không có mentor hoặc hệ thống hỗ trợ, bạn cảm thấy thế nào: vui vì tự do hay lo vì không có người chỉ?",
      "Nhìn vào người bạn muốn trở thành trong 5 năm - họ xây nền tảng bằng cách học đa dạng hay học chuyên sâu?",
    ],
    meaning: [
      `Team nhỏ và tổ chức lớn tạo ra hai trải nghiệm học hoàn toàn khác nhau. Không có cái nào tốt hơn - quan trọng là biết bạn cần gì ở giai đoạn này.`,
      `Team nhỏ (startup, SME): bạn đụng nhiều việc cùng lúc, học đa nhiệm, thấy impact nhanh, và hiểu cách một tổ chức vận hành ở level cao. Nhưng ít mentor, ít hệ thống, và bạn có thể học nhiều thứ ở mức nông thay vì học sâu một mảng.`,
      `Tổ chức lớn (corporate, MNC): bạn được đào tạo bài bản, có hệ thống tốt để học theo, và đi sâu vào một chuyên môn cụ thể. Nhưng bạn có thể bị giới hạn trong một mảng nhỏ và mất nhiều thời gian để thấy được bức tranh toàn cảnh.`,
      `Sai lầm phổ biến: chọn theo "hình ảnh công ty" - thích logo đẹp, văn phòng to, hay startup nghe cool - thay vì hỏi "ở đây tôi sẽ học được gì, theo cách nào?"`,
    ],
    example: `Anh Phú gia nhập một startup 15 người sau khi ra trường. Trong 1 năm, anh làm từ marketing đến product đến operations. Anh hiểu cách công ty vận hành, biết nhiều thứ - nhưng không cái nào thật sự sâu. Bạn thân anh, chị Bảo, vào Unilever - 1 năm chỉ làm brand management cho một ngành hàng. Chậm hơn về "trải nghiệm đa dạng", nhưng chị hiểu rất sâu về brand và consumer insight. Khi cả hai tìm việc sau 2 năm, Phú có breadth còn Bảo có depth - tùy vị trí, một trong hai sẽ phù hợp hơn.`,
    hints: [
      "A - Team nhỏ: Môi trường nhỏ, đụng nhiều việc cùng lúc (VD: startup, SME, agency, early-stage,...)",
      "B - Tổ chức lớn: Môi trường phân công rõ, đào tạo bài bản (VD: corporate lớn, MNC, consulting firm, ngân hàng,...)",
    ],
  },
  {
    n: 25, part: 3,
    title: "Bạn muốn lộ trình rõ hay tự tạo đường đi?",
    a: { label: "Lộ trình rõ ràng", desc: "Biết năm 1-3-5 mình sẽ ở đâu nếu làm tốt" },
    b: { label: "Tự tạo đường", desc: "Tự định nghĩa vai trò, tự vẽ career path của mình" },
    verify: [
      "Bạn thấy an tâm hơn khi biết rõ điều kiện thăng tiến, hay thích tự quyết định mình muốn phát triển theo hướng nào?",
      `Khi không biết "công ty đang đánh giá mình thế nào", bạn cảm thấy bình thường hay lo lắng?`,
      "Career path lý tưởng của bạn trông như thế nào: có các milestone rõ ràng hay một hướng mở với nhiều khả năng?",
    ],
    meaning: [
      `Câu hỏi này nghe đơn giản nhưng ảnh hưởng lớn đến sự hài lòng và động lực dài hạn của bạn trong công việc.`,
      `Lộ trình rõ ràng: bạn biết nếu làm tốt, sau 2 năm bạn sẽ lên senior analyst, sau 4 năm lên manager, và cứ thế. Bạn biết mình cần phát triển những năng lực gì để đến điểm tiếp theo. Corporate, banking, và consulting thường có ladder này. Nếu bạn cần biết mình đang tiến về đâu để cảm thấy ổn định, đây là môi trường phù hợp.`,
      `Tự tạo đường: không có roadmap định sẵn. Bạn tự định nghĩa vai trò của mình, tự tìm cơ hội phát triển, và thăng tiến bằng cách tạo ra impact mà tổ chức nhận thấy. Startup và môi trường sáng tạo thường hoạt động theo cách này.`,
      `Không có cái nào "tiến bộ" hơn. Người thích lộ trình rõ không phải thiếu tham vọng - họ chỉ cần different kind of clarity.`,
    ],
    example: `Anh Liêm cần biết mình đang tiến về đâu. Khi vào startup không có promotion path, anh thấy bất an dù công việc đang tốt - vì "không biết 3 năm nữa mình sẽ ở đâu". Khi chuyển sang Big 4 với career ladder rõ ràng từ associate đến manager đến senior manager, anh relaxed hơn hẳn và thực sự tập trung vào làm tốt công việc. Sự rõ ràng về lộ trình không kìm hãm anh - nó giải phóng anh khỏi lo lắng không cần thiết.`,
    hints: [
      "A - Lộ trình rõ: Môi trường có promotion path minh bạch (VD: Big 4, banking, MNC có career ladder rõ ràng,...)",
      "B - Tự tạo đường: Môi trường không có career map định sẵn (VD: startup, freelance, creative, entrepreneur,...)",
    ],
  },
  {
    n: 26, part: 3,
    title: "Bạn thích tốc độ nhanh hay chắc chắn?",
    a: { label: "Tốc độ nhanh", desc: "Launch sớm, sai rồi sửa, học nhiều trong thời gian ngắn" },
    b: { label: "Chắc chắn", desc: "Làm kỹ trước khi ra, ít lỗi, tiến độ ổn định và kiểm soát" },
    verify: [
      "Bạn thoải mái hơn khi: launch sớm và cải thiện dần, hay dành thêm thời gian để chắc chắn trước khi ra mắt?",
      "Khi sản phẩm/công việc của bạn có lỗi hoặc không hoàn hảo, bạn cảm thấy thế nào: học được gì hay stress vì không đạt chuẩn?",
      "Quyết định tốt với bạn là quyết định đúng, hay quyết định nhanh rồi điều chỉnh sau?",
    ],
    meaning: [
      `Tốc độ và sự chắc chắn là hai thứ thường đánh đổi nhau - và hiểu rõ bạn cần cái nào hơn giúp bạn tránh được nhiều thất vọng không đáng có.`,
      `Tốc độ nhanh: quyết định nhanh, launch sớm, sai rồi sửa. Startup và growth companies thường vận hành theo nhịp này. Bạn học nhiều trong thời gian ngắn, nhưng cũng phải chấp nhận sự không hoàn hảo và rủi ro thất bại cao hơn. Nếu bạn thích học qua thực chiến và thoải mái với sai lầm, đây là môi trường bạn phát triển nhanh.`,
      `Chắc chắn: quy trình kiểm tra kỹ, quyết định dựa trên đủ bằng chứng, ít khi sai nhưng cũng chậm hơn. Banking, finance, và engineering hệ thống critical vận hành theo nhịp này. Nếu bạn cần sự chắc chắn trước khi hành động và không thoải mái với rủi ro cao, đây là môi trường phù hợp.`,
      `Sai lầm là kỳ vọng kết quả của môi trường tốc độ nhanh nhưng lại không chấp nhận điều kiện của nó. Hoặc ngược lại - chọn môi trường an toàn nhưng kỳ vọng tốc độ phát triển của startup.`,
    ],
    example: `Chị Loan làm tại startup EdTech - sản phẩm ra nhanh, đôi khi còn bug. Cô thoải mái với điều đó vì "launch rồi học từ user nhanh hơn là ngồi perfecting mãi". Đồng nghiệp cũ của cô làm tại ngân hàng - mọi thứ phải test kỹ trước khi release, quy trình nhiều tầng review. Chậm hơn, nhưng ít lỗi hơn và phù hợp với yêu cầu của ngành. Cả hai đều đang làm đúng trong bối cảnh của mình.`,
    hints: [
      "A - Nhanh: Môi trường ưu tiên tốc độ, chấp nhận sai rồi sửa (VD: startup, agency, sales, growth roles,...)",
      "B - Chắc: Môi trường đặt độ chính xác lên trên tốc độ (VD: banking, finance, engineering hệ thống critical, legal, healthcare,...)",
    ],
  },
  {
    n: 27, part: 3,
    title: "Bạn muốn môi trường cạnh tranh hay an toàn?",
    a: { label: "Cạnh tranh", desc: "Áp lực liên tục từ đồng nghiệp giỏi giúp bạn phát triển nhanh" },
    b: { label: "An toàn", desc: "Không gian ổn định, ít so sánh, được thử và sai mà không sợ" },
    verify: [
      "Khi xung quanh đều là người giỏi hơn bạn, bạn thường cảm thấy gì đầu tiên: được kích thích muốn theo kịp hay áp lực và muốn trốn tránh?",
      "Bạn làm tốt hơn khi biết mình đang bị so sánh với đồng nghiệp, hay khi chỉ tập trung vào công việc của chính mình?",
      "Nghĩ về những giai đoạn bạn phát triển nhanh nhất - môi trường đó có cạnh tranh hay an toàn?",
    ],
    meaning: [
      `Cạnh tranh và an toàn không phải về tham vọng - chúng là về loại kích thích nào giúp bạn hoạt động tốt nhất.`,
      `Môi trường cạnh tranh tạo ra áp lực liên tục để bạn cải thiện. Bạn thấy người giỏi hơn mình xung quanh, được so sánh thường xuyên, và biết rằng nếu không đủ tốt, sẽ có người khác thay thế bạn. Nếu điều đó kích thích bạn phát triển, đây là môi trường bạn bứt phá. Nếu điều đó làm bạn lo lắng mãn tính, bạn sẽ burn out.`,
      `Môi trường an toàn tạo ra không gian để bạn thử, sai, và học mà không sợ bị đánh giá quá khắt khe. Nếu bạn cần sự ổn định tâm lý để làm tốt nhất, đây là điều kiện bạn cần. Nhưng nếu bạn cần áp lực bên ngoài để không "trôi", môi trường quá an toàn có thể khiến bạn chán.`,
      `Quan trọng: hãy nghĩ về lịch sử thực tế của bạn, không phải về bạn muốn nghĩ mình là ai. Nhiều người nghĩ mình "thích thử thách" nhưng thực ra cần an toàn để làm tốt nhất.`,
    ],
    example: `Anh Vinh và chị Hằng cùng join một công ty tech nổi tiếng có culture cạnh tranh cao. Vinh phát triển vượt bậc - sự cạnh tranh kích thích anh học liên tục. Hằng burn out sau 8 tháng - áp lực liên tục so sánh với đồng nghiệp làm cô mất tự tin thay vì phát triển. Không ai sai. Cùng một môi trường, hai kết quả hoàn toàn khác nhau - vì hai người cần hai loại kích thích khác nhau để hoạt động tốt nhất.`,
    hints: [
      "A - Cạnh tranh: Môi trường có pressure liên tục, bị so sánh là bình thường (VD: investment banking, consulting, sales ranking, top tech companies,...)",
      "B - An toàn: Môi trường ổn định tâm lý, ít so sánh, không gian để thử và sai (VD: NGO, government, education, SME culture tốt,...)",
    ],
  },
  {
    n: 28, part: 3,
    title: "Bạn có chấp nhận rủi ro nghề nghiệp không?",
    a: { label: "Chấp nhận rủi ro cao", desc: "Upside lớn, biến động nhiều - sẵn sàng đánh đổi để đổi lấy cơ hội" },
    b: { label: "Muốn rủi ro thấp", desc: "Ổn định, ít biến động - chấp nhận tăng trưởng chậm hơn nhưng chắc" },
    verify: [
      "Nếu công ty bạn vào đóng cửa sau 1 năm, bạn có thể bước tiếp không? Trong năm đó bạn đang build gì là tài sản thật sự của bạn?",
      "Bạn sẽ hối hận hơn vì đã không thử, hay vì đã thử và thất bại?",
      "Mức thu nhập giảm 30% so với tháng trước sẽ ảnh hưởng đến cuộc sống của bạn như thế nào?",
    ],
    meaning: [
      `Mọi lựa chọn career đều có rủi ro - chỉ là loại khác nhau và mức độ khác nhau. Không có lựa chọn nào thực sự "an toàn" hoàn toàn.`,
      `Rủi ro cao (startup, commission-based, freelance, entrepreneur): thu nhập không ổn định, công ty có thể không tồn tại sau 2 năm, vai trò có thể thay đổi hoàn toàn. Nhưng nếu bạn thành công, upside rất lớn - cả về kỹ năng, tài chính, và tốc độ phát triển.`,
      `Rủi ro thấp hơn (corporate, ngân hàng, government): thu nhập ổn định, công ty lâu đời ít biến động, con đường rõ hơn. Nhưng nếu ngành thay đổi hoặc kỹ năng của bạn bị làm mờ bởi automation, bạn có thể không chuẩn bị đủ để tiếp thu.`,
      `Sai lầm không phải là chọn rủi ro cao hay thấp - sai lầm là không nhìn thấy rủi ro của lựa chọn mình đang làm. Người chọn corporate an toàn nhưng không xây dựng kỹ năng có thể phải đối mặt với rủi ro lớn hơn vào năm 10.`,
    ],
    example: `Anh Khánh bỏ vị trí ổn định tại corporate để join startup seed-stage. 18 tháng sau, startup đóng cửa. Anh mất việc - nhưng trong 18 tháng đó, anh xây được skillset và network mà anh ước tính phải mất 5 năm mới có được ở corporate. Khi anh quay lại thị trường việc làm, anh nhận được offer tốt hơn nhiều so với trước khi join startup. Rủi ro anh chấp nhận đã trả lại xứng đáng - không phải vì startup thành công, mà vì anh đã chuẩn bị để survive khi nó thất bại.`,
    hints: [
      "A - Rủi ro cao: Môi trường upside lớn nhưng biến động nhiều (VD: startup seed stage, freelance, commission-based, entrepreneur,...)",
      "B - Rủi ro thấp: Môi trường ổn định, ít biến động, tăng trưởng chậm nhưng chắc (VD: MNC, government, ngân hàng lớn, corporate,...)",
    ],
  },
  {
    n: 29, part: 3,
    title: "Bạn muốn làm việc trong thị trường local hay global/remote?",
    a: { label: "Local", desc: "Thị trường trong nước, dễ vào, network và văn hóa quen thuộc" },
    b: { label: "Global/Remote", desc: "Tiêu chuẩn quốc tế, pool cơ hội rộng hơn, lương cao hơn" },
    verify: [
      "Trong 5 năm tới, bạn muốn làm việc với team Việt Nam hay team international từ nhiều nước?",
      "Tiếng Anh của bạn hiện tại đủ để làm việc professional hoàn toàn bằng tiếng Anh chưa? Nếu chưa, kế hoạch là gì?",
      "Bạn đang chuẩn bị gì để match với tiêu chuẩn của thị trường bạn muốn vào?",
    ],
    meaning: [
      `Với sự phát triển của remote work, câu hỏi này trở nên quan trọng hơn bao giờ hết - không chỉ về địa lý, mà về tiêu chuẩn và cơ hội bạn tiếp cận được.`,
      `Thị trường local: dễ vào hơn, ngôn ngữ và văn hóa quen thuộc, network xây dựng dễ hơn. Nhưng độ mở cơ hội nhỏ hơn, lương thường thấp hơn so với global standard, và bạn chỉ tiếp xúc với một cách làm việc.`,
      `Thị trường global/remote: tiêu chuẩn cao hơn - tiếng Anh tốt, kỹ năng làm việc cross-cultural, khả năng tự quản lý trong môi trường phân tán. Nhưng nếu bạn đạt được tiêu chuẩn đó, pool cơ hội rộng hơn nhiều và lương thường cao hơn đáng kể.`,
      `Cơ hội global không tự đến. Nó đi kèm với tiêu chuẩn rõ ràng - và nếu bạn muốn đến đó, bạn cần chuẩn bị từ sớm, không phải đợi đến khi muốn apply.`,
    ],
    example: `Chị Thư bắt đầu chuẩn bị cho global market từ năm 2 đại học: luyện tiếng Anh B2, thực tập tại công ty Singapore đang có văn phòng tại Việt Nam, build LinkedIn bằng tiếng Anh với content về công việc của mình. Khi ra trường, cô nhận được offer remote từ một startup Singapore với mức lương cao hơn 60% so với offer local tốt nhất cô nhận được. Đồng nghiệp không chuẩn bị tương tự - chỉ có cơ hội local.`,
    hints: [
      "A - Local: Môi trường trong nước, dễ vào hơn nhưng cần kế hoạch differentiation rõ (VD: doanh nghiệp Việt, SME, government, retail,...)",
      "B - Global/Remote: Môi trường cross-border, tiêu chuẩn quốc tế - cần đầu tư sớm vào ngôn ngữ, kỹ năng, và portfolio (VD: tech company nước ngoài, remote-first startup, MNC, outsourcing,...)",
    ],
  },
  {
    n: 30, part: 3,
    title: "Bạn muốn công việc ổn định hay nhiều cơ hội bứt phá?",
    a: { label: "Ổn định", desc: "Ít biến động, thu nhập đều, phù hợp khi cần tập trung vào thứ khác" },
    b: { label: "Bứt phá", desc: "Tốc độ cao, upside lớn, phù hợp khi sẵn sàng all-in vào career" },
    verify: [
      "Giai đoạn này của cuộc đời, bạn cần gì nhiều hơn: sự ổn định để tập trung vào thứ khác, hay tốc độ tăng trưởng cao dù không chắc chắn?",
      "Nhìn vào 12 tháng tới - có sự kiện lớn nào (gia đình, học tập, sức khỏe) ảnh hưởng đến mức độ rủi ro bạn có thể dành cho career không?",
      `Bạn đang chọn vì nó phù hợp với giai đoạn hiện tại, hay vì áp lực xã hội - "startup mới hay", "corporate mới ổn định"?`,
    ],
    meaning: [
      `Đây là câu hỏi cuối - và thường là câu hỏi phản ánh rõ nhất giai đoạn bạn đang ở trong cuộc sống, chứ không chỉ trong career.`,
      `Ổn định không phải là thiếu tham vọng. Có những giai đoạn trong cuộc sống bạn cần sự ổn định để tập trung vào thứ khác - gia đình, sức khỏe, học thêm, hoặc đơn giản là phục hồi sau một giai đoạn căng thẳng. Chọn môi trường ổn định trong giai đoạn đó là quyết định khôn ngoan.`,
      `Bứt phá không phải luôn tốt hơn. Môi trường tốc độ cao đòi hỏi bạn all-in - không phải lúc nào cũng phù hợp với hoàn cảnh thực tế của bạn. Nếu bạn chọn bứt phá nhưng không thực sự sẵn sàng, bạn sẽ cảm thấy mình "thất bại" trong khi thực ra chỉ là chọn sai thời điểm.`,
      `Career là chuỗi giai đoạn - không phải một quyết định duy nhất cho cả đời. Bạn có thể chọn ổn định trong 2 năm, rồi bứt phá trong 3 năm tiếp theo. Biết mình đang ở giai đoạn nào, và cần gì trong giai đoạn đó, là kỹ năng quan trọng nhất.`,
    ],
    example: `Sau 2 năm làm việc điên cuồng tại startup - học nhiều nhưng kiệt sức - anh Minh quyết định về MNC để "lấy lại sức và học hệ thống". Nhiều bạn bè ngạc nhiên: "Sao lại chọn corporate?" Nhưng Minh biết mình cần gì ở giai đoạn đó. Sau 2 năm ở MNC - tích lũy kỹ năng hệ thống, network, và phục hồi năng lượng - anh quay lại startup market với nền tảng tốt hơn nhiều. Không phải bước lùi - là chiến lược.`,
    hints: [
      "A - Ổn định: Môi trường ít biến động, phù hợp khi cần tập trung vào thứ khác trong cuộc sống (VD: corporate, MNC, government, ngân hàng,...)",
      "B - Bứt phá: Môi trường tốc độ cao, phù hợp khi sẵn sàng all-in vào career (VD: startup, sales commission, entrepreneur, growth roles,...)",
    ],
  },
];
