export default function PrivacyPage() {
  return (
    <div className="policy-page">
      <div className="policy-card">
        <div className="policy-card__header">
          <p className="policy-eyebrow">개인정보처리방침</p>
          
          <p>
            ProctorAI는 응시자와 운영자의 신뢰를 바탕으로 시험 서비스를 제공하기 위해 필요한 최소한의
            개인정보를 수집하고 안전하게 관리합니다.
          </p>
        </div>

        <div className="policy-content">
          <section className="policy-section">
            <h2>1. 수집하는 개인정보</h2>
            <ul className="policy-list">
              <li>이름, 이메일 주소</li>
              <li>응시번호, 시험 정보</li>
              <li>웹캠 영상, 화면 공유 정보</li>
              <li>AI 분석 결과, 시험 결과</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>2. 개인정보 이용 목적</h2>
            <ul className="policy-list">
              <li>본인 확인 및 시험 접속 관리</li>
              <li>시험 운영 및 응시자 상태 점검</li>
              <li>AI 기반 부정행위 탐지 및 분석</li>
              <li>시험 결과 제공 및 서비스 품질 개선</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>3. 보관 기간</h2>
            <p>
              수집된 개인정보는 시험 운영 및 결과 확인 목적이 달성된 후, 관련 법령 및 기관 정책에 따라 안전하게 보관되거나
              파기됩니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>4. 제3자 제공 여부</h2>
            <p>
              본 서비스는 시험 운영 및 부정행위 분석 목적에 한해 필요한 범위에서만 내부 운영자 및 승인된 시스템에 정보를 제공할 수
              있으며, 별도 동의 없이 외부에 무단 제공하지 않습니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>5. 개인정보 파기</h2>
            <p>
              보관 기간이 만료되거나 수집 목적이 달성된 경우, 안전한 방식으로 파기하며 필요한 경우 복구 불가능한 형태로 삭제합니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>6. 이용자의 권리</h2>
            <p>
              이용자는 본인의 개인정보에 대해 열람, 정정, 삭제, 처리 정지 등을 요청할 수 있으며, 운영자에게 문의하여 필요한 조치를
              요청할 수 있습니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>7. 문의 안내</h2>
            <p>
              개인정보 관련 문의는 운영자 또는 기관의 안내 채널을 통해 접수해 주세요. 문의 접수 후 가능한 범위 내에서 신속하게
              답변드리겠습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
