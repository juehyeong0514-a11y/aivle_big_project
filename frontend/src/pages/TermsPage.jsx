export default function TermsPage() {
  return (
    <div className="policy-page">
      <div className="policy-card">
        <div className="policy-card__header">
          <p className="policy-eyebrow">서비스 이용약관</p>
          
          <p>
            AI 리터러시 역량 테스트 플랫폼은 기업과 교육기관이 AI 역량 시험을 안전하고 효율적으로 운영할 수 있도록
            설계된 온라인 시험 환경입니다.
          </p>
        </div>

        <div className="policy-content">
          <section className="policy-section">
            <h2>1. 서비스 목적</h2>
            <p>
              본 서비스는 응시자가 시험에 참여하고, 관리자가 시험을 운영하며, AI 기반 감독 기능을 통해 부정행위를 탐지할 수
              있도록 지원합니다. 시험은 코드 작성, 제출, 실시간 모니터링 등 다양한 형태로 진행될 수 있습니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>2. 서비스 제공 내용</h2>
            <ul className="policy-list">
              <li>시험 응시, 장비 점검, 시험 진행 및 결과 확인 기능</li>
              <li>관리자 및 감독관을 위한 시험 운영·모니터링 기능</li>
              <li>웹캠, 화면 공유, 응시 행동 기반 AI 분석 기능</li>
              <li>시험 결과 집계 및 운영자 안내 제공</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>3. 이용자의 의무</h2>
            <p>
              이용자는 본 서비스를 공정하고 성실하게 이용해야 하며, 제공된 계정 정보와 시험 환경을 본인 책임하에 관리해야
              합니다. 허가받지 않은 제3자와 계정을 공유하거나 시험 운영 방침을 위반하는 행위는 금지됩니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>4. 시험 중 부정행위 금지</h2>
            <p>
              시험 중 부정행위, 타인과의 외부 협조, 허용되지 않은 자료 활용, 화면 공유 또는 웹캠 설정 우회 등은 엄격히 금지됩니다.
              AI 기반 감독 시스템은 이러한 행위를 탐지하기 위해 응시 행동과 시험 환경을 분석할 수 있습니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>5. 서비스 이용 제한</h2>
            <p>
              운영자는 시스템의 안전성, 시험의 공정성, 보안 및 법령 준수를 위해 서비스 이용을 일시적 또는 영구적으로 제한할 수
              있습니다. 특히 부정행위가 확인되거나 시스템 오남용이 의심되는 경우 해당 이용을 중단할 수 있습니다.
            </p>
          </section>

          <section className="policy-section">
            <h2>6. 책임의 제한</h2>
            <p>
              본 서비스는 시험 운영의 편의와 모니터링 지원을 제공하지만, AI 분석 결과는 참고 자료로만 활용되며 최종 판단은 운영자와
              기관의 정책에 따릅니다. 서비스 이용 중 발생할 수 있는 네트워크 문제, 장치 오류, 외부 환경 변화에 대해 당사는 책임을
              제한할 수 있습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
