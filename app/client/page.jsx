'use client'
import HorizontalCalendar from '@public/components/HorizontalCalendar';
import ModalConfirm from '@public/components/ModalConfirm';
import TimePicker from '@public/components/TimePicker';
import React, { useState, useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const page = () => {


  /* Form */

  const [formActive, setFormActive] = useState(false);

  const handleFormToggle = () => {
    if (!formActive) {
      setSelectedDate(null);
      setSelectedTime(null);
    }
    setFormActive(!formActive);
  };

  /* Calendar */

  const calRef = useRef(null);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // 30 días a partir de hoy

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    setSelectedTime(null);
  };

  /* TimePicker */

  const [reservedSlots, setReservedSlots] = useState([])

  /* Modal Confirm */

  const [confirmModalText, setConfirmModalText] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);

  const handleConfirmModal = () => {
    var hour = format(selectedTime, 'HH:mm')
    var date = format(selectedDate, 'EEEE, d LLLL', { locale: es })
    setConfirmModalText(`¿Estás seguro de que quieres agendar tu cita para el ${date}, a las ${hour}?`)
    setConfirmModal(current => !current)
  }

  const responseConfirmModal = async () => {
    handleConfirmModal();

    calRef.current?.clear()
    handleFormToggle()
  }

  return (
    <>
      <ModalConfirm mainText={confirmModalText} active={confirmModal} setActive={handleConfirmModal} response={responseConfirmModal} />
      <div className='client-dashboard'>
        <div className="dashboard-header">
          <div className="dashboard-header__title">
            Bienvenido a <b>ARKAD</b>
          </div>
        </div>
        <div className="dashboard-body">
          <div className={"dashboard-body__form " + (formActive ? 'active' : '')}>
            <div className="form">
              <div className="form__title">
                Agendar nueva cita
              </div>
              <div className="form__subtitle">
                Selecciona el día y la hora para tu cita
              </div>
              <div className="form__calendar">
                <HorizontalCalendar ref={calRef} onDateChange={handleDateChange} endDate={endDate} />
              </div>
              <div className="form__timepicker">
                <TimePicker
                  selectedDate={selectedDate}
                  onTimeSelect={(dateTime) => setSelectedTime(dateTime)}
                  reservedSlots={reservedSlots} />
              </div>
              {
                selectedDate && selectedTime && (
                  <div className="form__button">
                    <button
                      className="confirm-button"
                      onClick={() => handleConfirmModal()}
                    >
                      Confirmar
                    </button>
                  </div>
                )
              }
            </div>
          </div>
          <div className={"dashboard-body__button" + (formActive ? ' active' : '')} onClick={() => (
            calRef.current?.clear(),
            handleFormToggle())}>
            {
              formActive ? 'Cerrar formulario' : 'Agendar cita'
            }
          </div>
        </div>

      </div>
    </>
  )
}

export default page