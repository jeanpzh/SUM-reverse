export interface ReporteHorario {
    message:  null;
    codError: null;
    data:     Datum[];
}

export interface Datum {
    codSemestre:           null;
    codFacultad:           number;
    desFacultad:           null;
    codEscuela:            number;
    desEscuela:            null;
    codEspecialidad:       number;
    codAsignatura:         string;
    desAsignatura:         string;
    codPlan:               null;
    desPlan:               null;
    codSeccion:            number;
    color:                 number;
    horaInicio:            string;
    horaFin:               string;
    dia:                   string;
    numDia:                number;
    codTipoHoraAsignatura: string;
    desTipoHoraAsignatura: string;
}
