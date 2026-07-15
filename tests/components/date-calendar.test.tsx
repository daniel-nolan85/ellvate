import { fireEvent, render } from '@testing-library/react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';

describe('DateCalendar', () => {
  test('renders Gluestack calendar anatomy and reports the selected day', async () => {
    const onChange = jest.fn();
    const view = await render(
      <DateCalendar
        initialMonth={new Date(2026, 6, 1)}
        onChange={onChange}
        testID="test-calendar"
        value={new Date(2026, 6, 14)}
      />,
    );

    expect(view.getByTestId('test-calendar')).toBeTruthy();
    expect(view.getByText('July 2026')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('July 18, 2026'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const selected = onChange.mock.calls[0]?.[0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(6);
    expect(selected.getDate()).toBe(18);
  });
});
