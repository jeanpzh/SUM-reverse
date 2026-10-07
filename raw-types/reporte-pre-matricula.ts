export interface ReportePreMatricula {
    message:  null;
    codError: null;
    data:     Datum[];
}

export interface Datum {
    codFacultad:        number;
    codEscuela:         number;
    codEspecialidad:    number;
    codArea:            null;
    codPlan:            string;
    codAsignatura:      string;
    desAsignatura:      string;
    num_ciclo_ano_asig: number;
    num_creditaje:      number;
    num_rep_plan_act:   number;
    num_mat_equiv:      number;
    num_rep_total:      number;
    ind_etapa:          string;
    gs_cod_orient:      null;
    gs_tip_asig:        null;
    totales_creditos:   number;
    codSeccion:         number;
    lisSeccion:         null;
}
