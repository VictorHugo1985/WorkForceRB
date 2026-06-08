# Feature Specification: Attendance Dashboard

**Feature Branch**: `018-attendance-dashboard`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Crear un dashboard de inicio, que te de un pantallazo de las asistencia de hoy, que permita consultar asistencias historicas y que te diferencia los colaboradores por area y que permite tener un resumen en un periodo determinado de un colaborador en particular"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Today's Attendance at a Glance (Priority: P1)

An administrator or supervisor opens the system and immediately sees a visual summary of today's attendance without needing to navigate elsewhere. The dashboard is the home screen. They can instantly tell how many people are present, how many are absent, and which areas have coverage gaps — all without clicking further.

**Why this priority**: This is the primary daily use case. Supervisors check attendance every morning; a slow or non-obvious path adds friction to a daily workflow. Everything else is secondary to this quick situational awareness.

**Independent Test**: Navigate to the home screen. Without any filters or configuration, the page loads and shows today's attendance grouped by area with present/absent counts.

**Acceptance Scenarios**:

1. **Given** the user is logged in as ADMINISTRADOR or SUPERVISOR, **When** they open the home/dashboard screen, **Then** they see a summary of today's attendance including: total present collaborators, total absent collaborators, and a per-area breakdown.
2. **Given** the dashboard is loaded for today, **When** an area has zero collaborators with marcaciones, **Then** that area still appears with all collaborators listed as absent.
3. **Given** the dashboard is loaded, **When** a collaborator has at least one marcacion today, **Then** they are shown as present with their check-in/check-out times visible.

---

### User Story 2 - Historical Attendance Query (Priority: P2)

A supervisor needs to review attendance for a past day or week. They select a date range (e.g., last Monday to Friday) and the dashboard refreshes to show attendance data for that period. Each collaborator shows how many days they attended out of the total days in the range.

**Why this priority**: Historical queries are the second most frequent use case — end-of-week reviews, incident investigations, or payroll validation all require looking back.

**Independent Test**: Select a custom date range for last week and verify each collaborator shows the correct number of attended vs. total days.

**Acceptance Scenarios**:

1. **Given** the user selects a date range of more than one day, **When** the filter is applied, **Then** each collaborator row shows "X/Y días" (days attended out of total days in range) instead of individual punch times.
2. **Given** a date range is selected, **When** the data loads, **Then** the area-level summary shows the aggregate attendance percentage for that area during the selected period.
3. **Given** the user selects a start date after the end date, **When** they attempt to apply the filter, **Then** an error message is shown and no query is executed.

---

### User Story 3 - Collaborator Period Summary (Priority: P3)

A payroll administrator wants to review a specific collaborator's attendance history for a given period — for example, the last 30 days — to verify hours worked or investigate absences. They search by the collaborator's name or ID, select a date range, and see a compact summary: days present, total marcaciones per day, and any days without records.

**Why this priority**: This is a targeted analytical use case. It requires the date-range filter (P2) to be in place first, and it layers collaborator-specific filtering on top of it.

**Independent Test**: Search for a specific collaborator by name, set a 2-week date range, and verify the summary shows only that collaborator's attendance for the selected period.

**Acceptance Scenarios**:

1. **Given** the user types a collaborator's name or ID in the search field and applies the filter, **When** the data loads, **Then** only that collaborator is shown, with their daily attendance detail for the selected date range.
2. **Given** a collaborator is filtered, **When** a day in the range has no marcaciones, **Then** that day is shown as absent (not omitted).
3. **Given** the user clears the collaborator search field, **When** the filter is re-applied, **Then** all collaborators are shown again.

---

### User Story 4 - Area Breakdown Navigation (Priority: P4)

The dashboard organizes collaborators into collapsible area cards so supervisors who manage a single area can focus only on their area, while administrators can see the full picture. Each area card shows a visual indicator of coverage level (e.g., a progress bar or percentage).

**Why this priority**: The area breakdown provides organizational context that makes the dashboard actionable — a supervisor responsible for one area should not need to scroll past unrelated areas.

**Independent Test**: Collapse all area cards and verify only area-level summaries (name, attendance %, collaborator count) are visible. Expand one card and verify the collaborator list appears.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** multiple areas exist, **Then** each area is shown as a separate card with its name, the number of present collaborators, total collaborators, and an attendance percentage.
2. **Given** an area card is expanded, **When** the user views the collaborator list, **Then** present collaborators are visually distinguished from absent ones (e.g., color-coded indicator).
3. **Given** a collaborator has no area assigned, **When** the dashboard loads, **Then** that collaborator appears under a "Sin área" group.

---

### Edge Cases

- What happens when no marcaciones exist for the entire selected date range? → Dashboard shows all collaborators as absent with zero attendance for the period.
- How does the system handle a collaborator who is active but has never had a biometric event? → Shown as absent with no marcaciones.
- What if the selected date range spans a weekend or holiday with no expected attendance? → The system shows raw data; it does not filter out non-working days automatically.
- What if a collaborator's name search returns no matches? → A "No se encontraron colaboradores" message is shown instead of an empty page.
- What if an area has a very large number of collaborators (50+)? → The collaborator list within an area card is scrollable; the card does not expand to an unmanageable height.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display today's attendance by default when first loaded, without requiring any user input.
- **FR-002**: The dashboard MUST group collaborators by their assigned area, with each area displayed as a distinct section.
- **FR-003**: Collaborators without an assigned area MUST appear in a dedicated "Sin área" section.
- **FR-004**: The dashboard MUST show quick-select filters for: Today, Yesterday, This Week, and Custom Range.
- **FR-005**: The dashboard MUST allow users to enter a custom start date and end date to query any historical date range.
- **FR-006**: The dashboard MUST provide a text search field to filter results to a single collaborator by name, surname, or ID number.
- **FR-007**: For a single-day view, the dashboard MUST show each collaborator's individual marcaciones (check-in/check-out times) for that day.
- **FR-008**: For a multi-day view, the dashboard MUST show each collaborator's attendance count as "days present / total days in range."
- **FR-009**: Each area section MUST display a visual attendance percentage indicator showing the proportion of present collaborators.
- **FR-010**: The dashboard MUST visually distinguish present collaborators from absent ones within each area section.
- **FR-011**: Area sections MUST be collapsible so users can hide the collaborator list and view only the area-level summary.
- **FR-012**: The dashboard MUST show a summary banner with: total present collaborators, total absent collaborators, overall attendance percentage, and the active date range.
- **FR-013**: The dashboard MUST be restricted to users with ADMINISTRADOR or SUPERVISOR roles; other roles MUST NOT have access.
- **FR-014**: The dashboard MUST reflect real-time or near-real-time data — attendance shown must correspond to marcaciones recorded up to the current moment.

### Key Entities

- **Colaborador**: An active employee tracked in the system; belongs to an area; identified by name, surname, and ID number.
- **Area**: An organizational grouping of collaborators; used to partition the dashboard view.
- **Marcacion**: A biometric punch event associated with a collaborador on a specific date and time; represents a check-in or check-out.
- **Periodo de consulta**: The active date range selected by the user; determines which marcaciones are included in the dashboard view.
- **Resumen de asistencia**: An aggregated view per collaborador for a given period: days present, days absent, marcaciones detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A supervisor can determine the attendance status of any collaborator for today within 10 seconds of opening the dashboard, without any additional navigation.
- **SC-002**: The dashboard loads today's attendance data in under 3 seconds for organizations with up to 200 active collaborators.
- **SC-003**: A user can apply a date range filter and see updated results in under 3 seconds.
- **SC-004**: A user can search for a specific collaborator by name and see their filtered attendance in under 2 seconds after submitting the search.
- **SC-005**: 90% of daily users can identify areas with attendance below 50% coverage at a glance without reading individual collaborator names.
- **SC-006**: The dashboard correctly reflects attendance data matching the biometric event records — zero discrepancies between dashboard counts and raw event counts for the same period.

## Assumptions

- Only users with ADMINISTRADOR or SUPERVISOR roles can access the attendance dashboard; EMPLEADO role cannot.
- "Present" is defined as: a collaborador has at least one biometric marcacion recorded on the given date.
- "Absent" is defined as: an active collaborador with zero marcaciones on a given date.
- The system does not distinguish between scheduled working days and non-working days; attendance is shown for all calendar days in the selected range.
- A collaborador's area assignment reflects their current area at query time; historical area changes are not tracked in the dashboard view.
- The system's timezone for date calculations is Bolivia standard time (UTC-4), consistent with the rest of the application.
- The collaborador search is not case-sensitive and supports partial name matching.
- Area sections are ordered alphabetically; collaborators within an area are ordered by surname then first name.
- Mobile responsiveness is desirable but desktop is the primary use case for this dashboard.
