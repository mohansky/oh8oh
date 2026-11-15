import * as React from 'react'
import { cn } from '../../lib/utils'
import { Input } from './input'
import { Button } from './button'

interface TimePickerProps {
  value?: string // HH:mm format (24-hour)
  onChange?: (value: string) => void
  onBlur?: () => void
  className?: string
  use12Hour?: boolean
}

export function TimePicker({
  value = '',
  onChange,
  onBlur,
  className,
  use12Hour = true,
}: TimePickerProps) {
  const [hours, setHours] = React.useState('12')
  const [minutes, setMinutes] = React.useState('00')
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM')

  // Parse initial value
  React.useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':')
      const hour24 = parseInt(h, 10)
      // const minute = parseInt(m, 10)

      if (use12Hour) {
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
        setHours(hour12.toString().padStart(2, '0'))
        setPeriod(hour24 >= 12 ? 'PM' : 'AM')
      } else {
        setHours(h.padStart(2, '0'))
      }
      setMinutes(m.padStart(2, '0'))
    }
  }, [value, use12Hour])

  // Update parent when time changes
  const updateTime = React.useCallback(
    (newHours: string, newMinutes: string, newPeriod: 'AM' | 'PM') => {
      let hour24 = parseInt(newHours, 10)

      if (use12Hour) {
        if (newPeriod === 'PM' && hour24 !== 12) {
          hour24 += 12
        } else if (newPeriod === 'AM' && hour24 === 12) {
          hour24 = 0
        }
      }

      const timeString = `${hour24.toString().padStart(2, '0')}:${newMinutes.padStart(2, '0')}`
      onChange?.(timeString)
    },
    [onChange, use12Hour]
  )

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    const maxHour = use12Hour ? 12 : 23
    const num = parseInt(val, 10)

    if (val === '') {
      setHours('')
      return
    }

    if (num > maxHour) {
      val = maxHour.toString()
    } else if (num === 0 && use12Hour) {
      val = '12'
    }

    setHours(val)
    if (val.length === 2) {
      updateTime(val, minutes, period)
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    const num = parseInt(val, 10)

    if (val === '') {
      setMinutes('')
      return
    }

    if (num > 59) {
      val = '59'
    }

    setMinutes(val)
    if (val.length === 2 && hours) {
      updateTime(hours, val, period)
    }
  }

  const handlePeriodToggle = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM'
    setPeriod(newPeriod)
    if (hours && minutes) {
      updateTime(hours, minutes, newPeriod)
    }
  }

  const handleBlur = () => {
    // Pad values when user leaves the field
    if (hours) {
      const paddedHours = hours.padStart(2, '0')
      setHours(paddedHours)
    }
    if (minutes) {
      const paddedMinutes = minutes.padStart(2, '0')
      setMinutes(paddedMinutes)
      if (hours) {
        updateTime(hours.padStart(2, '0'), paddedMinutes, period)
      }
    }
    onBlur?.()
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="HH"
          value={hours}
          onChange={handleHoursChange}
          onBlur={handleBlur}
          maxLength={2}
          className="w-14 text-center"
        />
        <span className="text-lg font-semibold">:</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="MM"
          value={minutes}
          onChange={handleMinutesChange}
          onBlur={handleBlur}
          maxLength={2}
          className="w-14 text-center"
        />
      </div>
      {use12Hour && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePeriodToggle}
          className="w-16"
        >
          {period}
        </Button>
      )}
    </div>
  )
}
