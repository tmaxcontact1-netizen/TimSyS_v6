# Gradebook Workspace contract

Gradebook Workspace is the operational read model assembled from Gradebook Core, Academic Structure, Assessment Evidence, and Grade Evaluation. It owns no academic evidence and performs no calculation.

Reporting-period configuration resolves as one complete configuration in strict order: gradebook, course/subject, programme, then school. Lower-precedence periods are not mixed into the selected configuration. A requested period must belong to the resolved configuration.

The workspace returns at most 50 roster rows per page. It includes active and withdrawn enrolment history, period-filtered assessments, each student's latest non-superseded evidence cell, and the latest current calculated or overridden result. Missing cells remain absent; the read model never invents a zero or silently evaluates a student.
