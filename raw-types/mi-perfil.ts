export interface MiPerfil {
    message:  null;
    codError: null;
    data:     Data;
}

export interface Data {
    tipoDocumento:       string;
    numDocumento:        string;
    estadoCivil:         string;
    codSexo:             string;
    desSexo:             string;
    fechaNacimiento:     string;
    departamentoNac:     string;
    provinciaNac:        string;
    distritoNac:         string;
    telefono:            string;
    celular:             string;
    correoInstitucional: string;
    correoPersonal:      string;
    departamentoDir:     string;
    provinciaDir:        string;
    distritoDir:         string;
    direccion:           string;
    anioIngreso:         string;
    codTipoIngreso:      string;
    desTipoIngreso:      string;
    codColegioProc:      string;
    desColegioProc:      string;
    anioEstudio:         number;
    promedio:            number;
    situAcademica:       string;
    permanencia:         string;
    codSemUltMat:        string;
    promUltMat:          number;
}
