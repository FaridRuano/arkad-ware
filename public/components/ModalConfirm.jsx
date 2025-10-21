import React from 'react'

const ModalConfirm = ({ mainText, active, setActive, response }) => {

    if (active) {
        return (
            <div className='modal-container' >
                <div className="modal-warp">
                    <div className="warp-header">
                        <h4>
                            {mainText}
                        </h4>
                    </div>
                    <div className="warp-options">
                        <div className="option-modal confirm" onClick={()=>response()}>
                            Continuar
                        </div>
                        <div className="option-modal cancel" onClick={()=>setActive()}>
                            Cancelar
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default ModalConfirm