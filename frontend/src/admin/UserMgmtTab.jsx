import React, { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { api, authHeaders } from '../api/client';

export default function UserMgmtTab() {
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('ALL');

  useEffect(() => {
    setIsLoading(true);
    setLoadError('');

    api.get('/admin/candidates', { headers: authHeaders() })
      .then(({ data }) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setLoadError(
          '응시자 목록을 불러오지 못했습니다. 다시 로그인한 뒤 시도해주세요.'
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const organizations = useMemo(
    () => [
      ...new Set(
        users
          .map((user) => user.organizationName)
          .filter(Boolean)
      )
    ].sort(),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesOrganization =
        organizationFilter === 'ALL' ||
        user.organizationName === organizationFilter;

      const matchesSearch =
        !keyword ||
        [
          user.name,
          user.email,
          user.organizationName,
          user.candidateNumber
        ].some((value) =>
          String(value ?? '').toLowerCase().includes(keyword)
        );

      return matchesOrganization && matchesSearch;
    });
  }, [users, searchTerm, organizationFilter]);

  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}
      >
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef3c7',
            borderRadius: '10px',
            color: '#d97706'
          }}
        >
          <Users size={24} />
        </div>

        <div>
          <h2 className="card-title" style={{ margin: 0 }}>
            전체 응시자 및 결과 조회
          </h2>

          <p
            className="text-muted"
            style={{ fontSize: '0.9rem', margin: 0 }}
          >
            전체 조직의 응시자, 응시번호, 시험 배정과 결과 상태를
            조회합니다.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="alert-box alert-error">
          {loadError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap'
        }}
      >
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="이름, 이메일, 응시번호 검색"
          aria-label="응시자 검색"
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            padding: '0.75rem 0.9rem',
            border: '1px solid #dbe3ef',
            borderRadius: '8px',
            fontSize: '0.9rem',
            backgroundColor: '#ffffff'
          }}
        />

        <select
          value={organizationFilter}
          onChange={(event) =>
            setOrganizationFilter(event.target.value)
          }
          aria-label="조직 필터"
          style={{
            minWidth: '190px',
            padding: '0.75rem 0.9rem',
            border: '1px solid #dbe3ef',
            borderRadius: '8px',
            fontSize: '0.9rem',
            backgroundColor: '#ffffff'
          }}
        >
          <option value="ALL">전체 조직</option>

          {organizations.map((organization) => (
            <option key={organization} value={organization}>
              {organization}
            </option>
          ))}
        </select>
      </div>

      <div
        className="text-muted"
        style={{
          fontSize: '0.85rem',
          marginBottom: '0.75rem'
        }}
      >
        전체 {users.length}명 중 {filteredUsers.length}명 표시
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.9rem'
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '2px solid #e2e8f0',
                color: '#64748b'
              }}
            >
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                응시자 이름
              </th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                이메일
              </th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                조직
              </th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                응시번호
              </th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                상태
              </th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                결과
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted"
                  style={{ padding: '2rem', textAlign: 'center' }}
                >
                  응시자 목록을 불러오는 중입니다.
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <td
                    style={{
                      padding: '0.7rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {user.name || '-'}
                  </td>

                  <td
                    style={{
                      padding: '0.7rem',
                      color: '#64748b'
                    }}
                  >
                    {user.email || '-'}
                  </td>

                  <td
                    style={{
                      padding: '0.7rem',
                      color: '#64748b',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.organizationName || '미배정'}
                  </td>

                  <td
                    style={{
                      padding: '0.7rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.candidateNumber || '-'}
                  </td>

                  <td style={{ padding: '0.7rem' }}>
                    <span className="badge-status badge-available">
                      {user.approvalStatus === 'APPROVED'
                        ? '승인 완료'
                        : user.approvalStatus || '상태 없음'}
                    </span>
                  </td>

                  <td style={{ padding: '0.7rem' }}>
                    {user.assignments?.length ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}
                      >
                        {user.assignments.map((assignment) => (
                          <span
                            key={
                              assignment.id ??
                              `${user.id}-${assignment.examId}`
                            }
                            className="text-muted"
                          >
                            {assignment.examTitle}:{' '}
                            {assignment.score ?? '미응시'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">미배정</span>
                    )}
                  </td>
                </tr>
              ))}

            {!isLoading &&
              !loadError &&
              filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted"
                    style={{ padding: '2rem', textAlign: 'center' }}
                  >
                    조건에 맞는 응시자가 없습니다.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}