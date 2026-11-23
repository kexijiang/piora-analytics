export function employeeLabel(employee?: {
  name: string | null;
  employee_no: string | null;
}) {
  if (!employee) return "待确认";
  if (!employee.name) return employee.employee_no ?? "未命名员工";
  return employee.employee_no
    ? employee.name + "（" + employee.employee_no + "）"
    : employee.name;
}
