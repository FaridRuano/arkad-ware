'use client'
import HorizontalCalendar from '@public/components/client/HorizontalCalendar';
import ModalConfirm from '@public/components/shared/ModalConfirm';
import TimePicker from '@public/components/client/TimePicker';
import React, { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { es, tr } from 'date-fns/locale'
import { toZonedTime } from '@node_modules/date-fns-tz/dist/cjs';
import { set } from 'mongoose';

const TUTOR_TIME_ZONE = "America/Guayaquil";

const page = () => {

  const [loading, setLoading] = useState(true);

  /* Form */

  const [formActive, setFormActive] = useState(false);

  const handleFormToggle = () => {
    if (!formActive) {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedType(null);
    }
    setFormActive(!formActive);
  };

  /* Type */

  const [selectedType, setSelectedType] = useState(null);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setSelectedTime(null);
    calRef.current?.clear();
  }

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
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* Load ALL Pending Appointments */

  useEffect(() => {
    if (!selectedDate) return;

    const controller = new AbortController();

    const loadReserved = async () => {

      setLoadingSlots(true);
      try {
        // 👇 IMPORTANTÍSIMO: formatea en Guayaquil, no con toISOString
        const dateStr = format(
          toZonedTime(selectedDate, TUTOR_TIME_ZONE),
          "yyyy-MM-dd"
        );

        // opcional: limpia de una para que no “se vea” lo anterior
        setReservedSlots([]);

        const res = await fetch(`/api/appointments/pending/day?date=${dateStr}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await res.json();

        if (!controller.signal.aborted) {
          if (res.ok && data.ok) setReservedSlots(data.appointments || []);
          else setReservedSlots([]);
          setLoadingSlots(false);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Error cargando slots:", e);
          setReservedSlots([]);
        }
      }
    };

    loadReserved();

    return () => controller.abort();
  }, [selectedDate]);

  /* Modal Confirm Schedule */

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
    setLoading(true);

    const typeDuration = selectedType === 'opcion1' ? 30 : 60;

    const appointmentData = {
      date: selectedDate,
      time: selectedTime,
      type: typeDuration,
    };

    console.log("Appointment Data:", appointmentData);

    try {
      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });

      if (!res.ok) {
        console.error("No se pudo agendar la cita", res);
        setLoading(false);
        return;
      }

    } catch (error) {
      console.error("Error al agendar la cita:", error);
    }
    loadPending();
    setLoading(false);
    calRef.current?.clear()
    handleFormToggle()
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Cita Pendiente */

  const [pendingAppointments, setPendingAppointments] = useState([]);

  /* Modal Confirm Schedule */

  const [cancelAppointmentModalText, setCancelAppointmentModalText] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

  const handleCancelModal = (appointment) => {
    if (!appointment) {
      return setCancelModal(current => !current);
    }
    setAppointmentToCancel(appointment.id);
    var hour = format(appointment.start, 'HH:mm')
    var date = format(appointment.start, 'EEEE, d LLLL', { locale: es })
    setCancelAppointmentModalText(`¿Estás seguro de que quieres cancelar tu cita para el ${date}, a las ${hour}?`)
    setCancelModal(current => !current)
  }

  const responseCancelModal = async () => {
    handleCancelModal();
    setLoading(true);

    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: appointmentToCancel }),
      });

      if (!res.ok) {
        console.error("No se pudo cancelar la cita", res);

        setLoading(false);
        return;
      }

    } catch (error) {
      console.error("Error al cancelar la cita:", error);
    }
    loadPending();
    setLoading(false);
  }

  /* Load Pending Appointments */

  const loadPending = async () => {
    try {
      const res = await fetch("/api/appointments/pending/user", { method: "GET" });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.ok) return;

      // 👇 Convertimos startAt (string) -> Date para date-fns
      const mapped = (data.appointments || []).map((a) => ({
        id: a.id,
        start: new Date(a.startAt),
        durationMinutes: a.durationMinutes,
      }));

      setPendingAppointments(mapped);
      setLoading(false);
    } catch (e) {
      console.error("Error cargando citas:", e);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  if (loading) {
    return (
      <div className='client-dashboard loading'>
        <div className="spinner" aria-hidden="true"></div>
      </div>
    )
  }

  return (
    <>
      <ModalConfirm mainText={confirmModalText} active={confirmModal} setActive={handleConfirmModal} response={responseConfirmModal} />
      <ModalConfirm mainText={cancelAppointmentModalText} active={cancelModal} setActive={handleCancelModal} response={responseCancelModal} />
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
                Selecciona el tipo, el día y la hora para tu cita
              </div>


              <div className="form__type-buttons">
                <div
                  className={`type-button ${selectedType === 'opcion1' ? 'active' : ''}`}
                  onClick={() => handleTypeSelect('opcion1')}
                >
                  <div className="type-button__image">
                    <img src="/assets/imgs/arkad-img1.jpg" alt="Servicio Express Icon" />
                  </div>
                  <div className="type-button__text">
                    <h1>
                      Servicio Express <span>- 30 minutos.</span>
                    </h1>
                    <p>
                      La opcion perfecta si lo que buscas es un servicio rápido de cabello o barba o cejas.
                    </p>
                  </div>
                </div>
                <div
                  className={`type-button ${selectedType === 'opcion2' ? 'active' : ''}`}
                  onClick={() => handleTypeSelect('opcion2')}
                >
                  <div className="type-button__image">
                    <img src="/assets/imgs/arkad-img2.jpg" alt="Servicio Express Icon" />
                  </div>
                  <div className="type-button__text">
                    <h1 className='gold'>
                      Servicio Premium <span>- 1 hora.</span>
                    </h1>
                    <p>
                      Corte de cabello <b>PRO</b>. Incluye diseño, afeitada de barba y cejas.
                    </p>
                  </div>
                </div>
              </div>
              {
                selectedType && (
                  <>
                    <div className="form__calendar">
                      <HorizontalCalendar ref={calRef} onDateChange={handleDateChange} endDate={endDate} />
                    </div>
                    <div className={loadingSlots ? "form__timepicker loading" : "form__timepicker"}>
                      <TimePicker
                        selectedDate={selectedDate}
                        onTimeSelect={(dateTime) => setSelectedTime(dateTime)}
                        reservedSlots={reservedSlots}
                        selectedTime={selectedType}
                      />

                    </div>
                  </>
                )
              }

              {
                selectedDate && selectedTime && selectedType && (
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
        {
          pendingAppointments.length > 0 &&
          <>
            {pendingAppointments.map((appointment, index) => (
              <div className="dashboard-pending-appointments" key={index}>
                <h4>Cita Pendiente</h4>
                <ul>
                  <li>
                    {format(appointment.start, 'EEEE, d LLLL', { locale: es })}, a las {format(appointment.start, 'HH:mm')}
                  </li>
                </ul>
                <span onClick={() => handleCancelModal(appointment)}>Cancelar Cita</span>
              </div>
            ))}
          </>

        }

      </div>
    </>
  )
}

export default page