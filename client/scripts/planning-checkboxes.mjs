export async function setPlanningCheckbox(locator, checked = true) {
  const current = await locator.getAttribute('aria-checked')
  if (current === null) throw new Error('Expected a Radix planning checkbox')
  if ((current === 'true') !== checked) await locator.click()
}

export async function isPlanningCheckboxChecked(locator) {
  const current = await locator.getAttribute('aria-checked')
  if (current === null) throw new Error('Expected a Radix planning checkbox')
  return current === 'true'
}
