export default function FaqPage() {
  const faqs = [
    {
      question: '시험에 응시하려면 어떻게 하나요?',
      answer:
        '관리자가 제공한 응시 정보 또는 초대 링크를 통해 접속한 후 장비 점검을 완료하면 시험을 시작할 수 있습니다.'
    },
    {
      question: '웹캠 또는 마이크가 인식되지 않습니다.',
      answer:
        '브라우저의 카메라 및 마이크 권한을 허용한 후 다시 시도해 주세요.'
    },
    {
      question: '화면 공유가 되지 않습니다.',
      answer:
        '시험 응시를 위해 화면 공유 권한이 필요합니다. 브라우저 안내에 따라 화면을 선택하여 공유를 허용해 주세요.'
    },
    {
      question: 'AI는 어떤 정보를 분석하나요?',
      answer:
        '웹캠 영상, 화면 공유 정보 및 응시 행동을 분석하여 부정행위 여부를 판단합니다.'
    },
    {
      question: '시험 도중 인터넷이 끊기면 어떻게 되나요?',
      answer:
        '자동으로 재연결을 시도하며, 장시간 복구되지 않는 경우 관리자 안내에 따라 다시 접속해 주세요.'
    },
    {
      question: '시험 결과는 어디에서 확인하나요?',
      answer:
        '시험 종료 후 결과 페이지에서 확인할 수 있습니다.'
    },
    {
      question: '개인정보는 어떻게 관리되나요?',
      answer:
        '수집된 개인정보는 시험 운영 및 본인 확인 목적으로만 사용되며 개인정보처리방침에 따라 안전하게 관리됩니다.'
    }
  ];

  return (
    <div className="policy-page">
      <div className="policy-card">
        <div className="policy-card__header">
          <p className="policy-eyebrow">자주 묻는 질문</p>
          
          <p>시험 응시와 서비스 이용 중 자주 문의되는 내용을 정리해 두었습니다.</p>
        </div>

        <div className="policy-content">
          {faqs.map((item) => (
            <section className="policy-section faq-item" key={item.question}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
